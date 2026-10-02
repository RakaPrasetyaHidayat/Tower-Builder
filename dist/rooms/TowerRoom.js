"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerRoom = void 0;
const colyseus_1 = require("colyseus");
const GameState_1 = require("./schema/GameState");
const db_1 = require("../db");
const client_1 = require("@prisma/client");
function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
class TowerRoom extends colyseus_1.Room {
    maxClients = 31; // 1 Game Master + 30 Players
    gameTimer;
    botTimer;
    onCreate(options) {
        this.setState(new GameState_1.GameState());
        this.state.roomCode = (options.roomCode || generateRoomCode()).toUpperCase();
        this.setMetadata({ roomCode: this.state.roomCode });
        // 1. Handling "drop_block" (Both regular players and Sultan can participate)
        this.onMessage("drop_block", (client, data) => {
            if (this.state.status !== "PLAYING" || this.state.isPaused)
                return;
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.isAlive)
                return;
            const now = Date.now();
            // Check if frozen by sabotage or GM
            if (player.isFrozen) {
                if (now < player.frozenUntil) {
                    client.send("action_rejected", { reason: "Anda sedang dibekukan!" });
                    return;
                }
                else {
                    player.isFrozen = false;
                }
            }
            // Check Auto-Crane Buff
            let isPerfect = data.perfect;
            if (player.hasAutoCrane) {
                isPerfect = true;
                player.hasAutoCrane = false;
            }
            // Update height & combo
            player.towerHeight = data.height;
            player.isAlive = data.isAlive;
            player.lastPlacedAt = now;
            if (isPerfect) {
                player.combo += 1;
            }
            else {
                player.combo = 0;
            }
            // Calculate score with global multiplier & active Buff
            const basePoints = 100;
            const comboBonus = player.combo * 50;
            let multiplier = this.state.scoreMultiplier;
            // Active Double Funds Buff
            if (now < player.doubleFundsUntil) {
                multiplier *= 2.0;
            }
            const pointsEarned = Math.round((basePoints + comboBonus) * multiplier);
            player.score += pointsEarned;
            this.state.totalBlocksPlaced += 1;
            // Broadcast block event
            this.broadcast("block_event", {
                sessionId: client.sessionId,
                nickname: player.nickname,
                height: player.towerHeight,
                score: player.score,
                combo: player.combo,
                perfect: isPerfect,
                isAlive: player.isAlive,
            });
            // Setiap kelipatan 5 balok, kirim event trigger_card_choice (Pusaka Sakti Nusantara)
            if (player.isAlive && player.towerHeight > 0 && player.towerHeight % 5 === 0) {
                client.send("trigger_card_choice", {
                    height: player.towerHeight,
                    options: [
                        { type: "DOUBLE_FUNDS", category: "BUFF", name: "Berkah Dewi Sri", description: "Skor upeti 2x selama 10 detik" },
                        { type: "AUTO_CRANE", category: "BUFF", name: "Tangan Sakti Empu", description: "Balok berikutnya 100% presisi sempurna" },
                        { type: "LAND_DISPUTE", category: "SABOTASE", name: "Kutukan Jonggrang", description: "Jadikan lawan arca batu beku selama 5 detik" },
                        { type: "CORRUPTION", category: "SABOTASE", name: "Upeti Kadipaten", description: "Potong 25% skor upeti target lawan" },
                    ],
                });
            }
            // Cek jika seluruh player tereliminasi
            let anyPlayerAlive = false;
            this.state.players.forEach((p) => {
                if (p.isAlive && (p.role === "PLAYER" || p.towerHeight > 0))
                    anyPlayerAlive = true;
            });
            if (!anyPlayerAlive && this.state.players.size > 1) {
                this.finishMatch();
            }
        });
        // 2. Handling "select_card"
        this.onMessage("select_card", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.isAlive)
                return;
            const now = Date.now();
            switch (data.cardType) {
                case "DOUBLE_FUNDS": {
                    player.doubleFundsUntil = now + 10000;
                    client.send("card_applied", { cardType: "DOUBLE_FUNDS", durationMs: 10000 });
                    this.broadcast("feed_notification", {
                        message: `✨ ${player.nickname} menerima Berkah Dewi Sri (2x Upeti Skor)!`,
                    });
                    break;
                }
                case "AUTO_CRANE": {
                    player.hasAutoCrane = true;
                    client.send("card_applied", { cardType: "AUTO_CRANE" });
                    this.broadcast("feed_notification", {
                        message: `🔨 ${player.nickname} mengaktifkan Tangan Sakti Empu!`,
                    });
                    break;
                }
                case "LAND_DISPUTE": {
                    if (!data.targetSessionId)
                        return;
                    const target = this.state.players.get(data.targetSessionId);
                    if (target && target.isAlive) {
                        target.isFrozen = true;
                        target.frozenUntil = now + 5000;
                        const targetClient = this.clients.find((c) => c.sessionId === data.targetSessionId);
                        targetClient?.send("frozen_notification", { durationMs: 5000 });
                        this.broadcast("feed_notification", {
                            message: `❄️ ${player.nickname} mengutuk ${target.nickname} menjadi arca beku (5s)!`,
                        });
                        this.clock.setTimeout(() => {
                            if (target.isFrozen && Date.now() >= target.frozenUntil) {
                                target.isFrozen = false;
                            }
                        }, 5000);
                    }
                    break;
                }
                case "CORRUPTION": {
                    if (!data.targetSessionId)
                        return;
                    const target = this.state.players.get(data.targetSessionId);
                    if (target) {
                        const deduction = Math.max(100, Math.round(target.score * 0.25));
                        target.score = Math.max(0, target.score - deduction);
                        this.broadcast("feed_notification", {
                            message: `🔥 ${player.nickname} menarik Upeti Kadipaten dari ${target.nickname} (-${deduction} Poin)!`,
                        });
                    }
                    break;
                }
            }
        });
        // 3. Handling "set_multiplier" direct or admin
        this.onMessage("set_multiplier", (_client, data) => {
            if (data.multiplier && data.multiplier > 0) {
                this.state.scoreMultiplier = Number(data.multiplier);
                this.broadcast("feed_notification", {
                    message: `⚡ Sultan menetapkan Multiplier Upeti ${this.state.scoreMultiplier}x!`,
                });
            }
        });
        // 4. Handling "add_bots"
        this.onMessage("add_bots", (client) => {
            if (client.sessionId === this.state.gameMasterSessionId) {
                this.addSimulatedBots(5);
            }
        });
        // 5. Handling "force_finish"
        this.onMessage("force_finish", (client) => {
            if (client.sessionId === this.state.gameMasterSessionId) {
                this.finishMatch();
            }
        });
        // 6. Handling "admin_action"
        this.onMessage("admin_action", (client, data) => {
            if (client.sessionId !== this.state.gameMasterSessionId) {
                client.send("error", { message: "Aksi hanya diizinkan untuk Game Master" });
                return;
            }
            switch (data.action) {
                case "start_game": {
                    if (this.state.status === "PLAYING")
                        return;
                    this.state.status = "PLAYING";
                    this.state.isPaused = false;
                    this.state.timeRemaining = 180;
                    this.gameTimer?.clear();
                    this.gameTimer = this.clock.setInterval(() => {
                        if (!this.state.isPaused && this.state.status === "PLAYING") {
                            this.state.timeRemaining -= 1;
                            if (this.state.timeRemaining <= 0) {
                                this.finishMatch();
                            }
                        }
                    }, 1000);
                    this.startBotSimulation();
                    this.broadcast("match_started", { timeRemaining: 180 });
                    break;
                }
                case "pause_game": {
                    this.state.isPaused = true;
                    this.state.status = "PAUSED";
                    this.broadcast("match_paused");
                    break;
                }
                case "resume_game": {
                    this.state.isPaused = false;
                    this.state.status = "PLAYING";
                    this.broadcast("match_resumed");
                    break;
                }
                case "freeze_player": {
                    if (!data.targetSessionId)
                        return;
                    const target = this.state.players.get(data.targetSessionId);
                    if (target) {
                        target.isFrozen = !target.isFrozen;
                        target.frozenUntil = target.isFrozen ? Date.now() + 10000 : 0;
                        this.broadcast("feed_notification", {
                            message: target.isFrozen
                                ? `Game Master membekukan ${target.nickname}!`
                                : `Game Master melepas pembekuan ${target.nickname}.`,
                        });
                    }
                    break;
                }
                case "set_multiplier": {
                    if (data.multiplier && data.multiplier > 0) {
                        this.state.scoreMultiplier = Number(data.multiplier);
                        this.broadcast("feed_notification", {
                            message: `⚡ Multiplier Upeti diatur ke ${this.state.scoreMultiplier}x!`,
                        });
                    }
                    break;
                }
                case "add_bots": {
                    this.addSimulatedBots(5);
                    break;
                }
                case "force_finish": {
                    this.finishMatch();
                    break;
                }
                case "reset_match": {
                    this.gameTimer?.clear();
                    this.botTimer?.clear();
                    this.state.status = "LOBBY";
                    this.state.timeRemaining = 180;
                    this.state.scoreMultiplier = 1.0;
                    this.state.isPaused = false;
                    this.state.totalBlocksPlaced = 0;
                    this.state.winnerSessionId = "";
                    this.state.players.forEach((p) => {
                        p.score = 0;
                        p.towerHeight = 0;
                        p.combo = 0;
                        p.isAlive = true;
                        p.isFrozen = false;
                        p.doubleFundsUntil = 0;
                        p.hasAutoCrane = false;
                    });
                    this.broadcast("match_reset");
                    break;
                }
            }
        });
        // Backward-compatibility handlers
        this.onMessage("start_game", (client) => {
            if (client.sessionId === this.state.gameMasterSessionId) {
                this.broadcast("match_started");
                this.state.status = "PLAYING";
                this.startBotSimulation();
            }
        });
    }
    // Simulated AI Empu bots
    addSimulatedBots(count = 5) {
        const botTemplates = [
            "Empu Gandring (AI)",
            "Empu Supo (AI)",
            "Ken Arok (AI)",
            "Patih Gajah Mada (AI)",
            "Arya Penangsang (AI)",
            "Dyah Pitaloka (AI)",
            "Prabu Brawijaya (AI)",
        ];
        let addedCount = 0;
        for (let i = 0; i < count; i++) {
            const name = botTemplates[i % botTemplates.length];
            const botId = `bot_${Date.now()}_${i + 1}`;
            if (this.state.players.size < 30) {
                const bot = new GameState_1.PlayerState();
                bot.id = botId;
                bot.sessionId = botId;
                bot.nickname = name;
                bot.role = "PLAYER";
                bot.isAlive = true;
                bot.isReady = true;
                this.state.players.set(botId, bot);
                addedCount++;
            }
        }
        this.broadcast("feed_notification", {
            message: `🤖 ${addedCount} Empu Binaan Kerajaan (AI) telah masuk ke Arena Sayembara!`,
        });
    }
    startBotSimulation() {
        this.botTimer?.clear();
        this.botTimer = this.clock.setInterval(() => {
            if (this.state.status !== "PLAYING" || this.state.isPaused)
                return;
            const now = Date.now();
            this.state.players.forEach((player, sId) => {
                if (!sId.startsWith("bot_") || !player.isAlive)
                    return;
                // Skip if frozen
                if (player.isFrozen) {
                    if (now >= player.frozenUntil) {
                        player.isFrozen = false;
                    }
                    else {
                        return;
                    }
                }
                // 75% probability each tick
                if (Math.random() < 0.75) {
                    const rand = Math.random();
                    const isPerfect = rand > 0.45;
                    const isCollapse = player.towerHeight > 20 && rand < 0.04;
                    if (isCollapse) {
                        player.isAlive = false;
                        this.broadcast("feed_notification", {
                            message: `💥 Candi milik ${player.nickname} runtuh pada tingkat ${player.towerHeight}!`,
                        });
                        return;
                    }
                    player.towerHeight += 1;
                    if (isPerfect) {
                        player.combo += 1;
                    }
                    else {
                        player.combo = 0;
                    }
                    let multiplier = this.state.scoreMultiplier;
                    if (now < player.doubleFundsUntil)
                        multiplier *= 2.0;
                    const basePoints = 100;
                    const comboBonus = player.combo * 50;
                    player.score += Math.round((basePoints + comboBonus) * multiplier);
                    this.state.totalBlocksPlaced += 1;
                    this.broadcast("block_event", {
                        sessionId: player.sessionId,
                        nickname: player.nickname,
                        height: player.towerHeight,
                        score: player.score,
                        combo: player.combo,
                        perfect: isPerfect,
                        isAlive: player.isAlive,
                    });
                }
            });
        }, 2500);
    }
    onJoin(client, options) {
        // If client is first or requested host, assign GM if no GM set
        const isFirstPlayer = this.clients.length === 1;
        const isGameMaster = Boolean(options.isHost || (isFirstPlayer && !this.state.gameMasterSessionId));
        // Enforce max 30 players (+1 GM)
        if (!isGameMaster && this.clients.length > 31) {
            throw new Error("Room penuh (Maksimal 30 Pemain + 1 Game Master)");
        }
        const player = new GameState_1.PlayerState();
        player.id = client.id;
        player.sessionId = client.sessionId;
        player.nickname = options.nickname?.trim() || (isGameMaster ? "Sultan Keraton" : `Empu_${client.sessionId.slice(-4)}`);
        player.role = isGameMaster ? "GAME_MASTER" : "PLAYER";
        if (isGameMaster) {
            this.state.gameMasterSessionId = client.sessionId;
        }
        this.state.players.set(client.sessionId, player);
        console.log(`[TowerRoom ${this.state.roomCode}] ${player.role} Joined: ${player.nickname}`);
    }
    onLeave(client, _consented) {
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        console.log(`[TowerRoom ${this.state.roomCode}] Left: ${player.nickname}`);
        if (player.role === "GAME_MASTER") {
            let candidateSessionId = "";
            this.state.players.forEach((p, sId) => {
                if (sId !== client.sessionId && !sId.startsWith("bot_") && !candidateSessionId) {
                    candidateSessionId = sId;
                }
            });
            if (candidateSessionId) {
                const candidate = this.state.players.get(candidateSessionId);
                if (candidate) {
                    candidate.role = "GAME_MASTER";
                    this.state.gameMasterSessionId = candidateSessionId;
                }
            }
        }
        this.state.players.delete(client.sessionId);
    }
    // Auto-Save Match ke Neon DB & trigger match_over
    async finishMatch() {
        this.gameTimer?.clear();
        this.botTimer?.clear();
        this.state.status = "FINISHED";
        // Include all participants (players and playing GM)
        const allPlayers = Array.from(this.state.players.values());
        let playersArr = allPlayers.filter((p) => p.towerHeight > 0 || p.score > 0 || p.role === "PLAYER");
        if (playersArr.length === 0 && allPlayers.length > 0) {
            playersArr = [...allPlayers];
        }
        playersArr.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);
        const winner = playersArr[0];
        this.state.winnerSessionId = winner ? winner.sessionId : "";
        // Broadcast match_over
        this.broadcast("match_over", {
            roomCode: this.state.roomCode,
            winnerSessionId: this.state.winnerSessionId,
            winnerNickname: winner ? winner.nickname : "Tidak Ada",
            winnerScore: winner ? winner.score : 0,
            totalBlocks: this.state.totalBlocksPlaced,
            rankings: playersArr.map((p, idx) => ({
                rank: idx + 1,
                nickname: p.nickname,
                score: p.score,
                towerHeight: p.towerHeight,
            })),
        });
        // Auto-Save to Neon DB via Prisma with automatic retry
        try {
            let match;
            let participantData = [];
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const gmPlayer = this.state.players.get(this.state.gameMasterSessionId);
                    const hostUsername = gmPlayer?.nickname || "Sultan Keraton";
                    const hostUser = await db_1.prisma.user.upsert({
                        where: { username: hostUsername },
                        update: {},
                        create: { username: hostUsername },
                    });
                    // Dedup nicknames to avoid Prisma unique constraint conflicts on [matchId, nickname]
                    const seenNames = new Set();
                    participantData = await Promise.all(playersArr.map(async (p, idx) => {
                        let uniqueNick = p.nickname;
                        if (seenNames.has(uniqueNick)) {
                            uniqueNick = `${uniqueNick} #${idx + 1}`;
                        }
                        seenNames.add(uniqueNick);
                        const user = await db_1.prisma.user.upsert({
                            where: { username: uniqueNick },
                            update: {},
                            create: { username: uniqueNick },
                        });
                        return {
                            userId: user.id,
                            nickname: uniqueNick,
                            role: p.role === "GAME_MASTER" ? client_1.Role.GAME_MASTER : client_1.Role.PLAYER,
                            score: p.score,
                            towerHeight: p.towerHeight,
                            rank: idx + 1,
                        };
                    }));
                    match = await db_1.prisma.match.create({
                        data: {
                            roomCode: this.state.roomCode,
                            status: "FINISHED",
                            hostId: hostUser.id,
                            durationSeconds: Math.max(1, 180 - this.state.timeRemaining),
                            participants: {
                                create: participantData,
                            },
                        },
                    });
                    break; // Succeeded!
                }
                catch (retryErr) {
                    console.warn(`[Prisma / Neon DB] Percobaan ${attempt}/3 gagal menyimpan match:`, retryErr?.message || retryErr);
                    if (attempt === 3)
                        throw retryErr;
                    await new Promise((r) => setTimeout(r, 1200));
                }
            }
            console.log(`[Prisma / Neon DB] ✅ Match ${match.roomCode} tersimpan ke DB (ID: ${match.id})`);
            this.broadcast("db_saved", {
                matchId: match.id,
                roomCode: match.roomCode,
                participantCount: participantData.length,
                savedAt: new Date().toISOString(),
                winner: winner ? winner.nickname : "Tidak Ada",
            });
            this.broadcast("feed_notification", {
                message: `💾 Hasil Sayembara #${match.roomCode} sukses tersimpan ke Database Neon PostgreSQL!`,
            });
        }
        catch (error) {
            console.error("[Prisma / Neon DB] ❌ Gagal menyimpan data match:", error);
            this.broadcast("feed_notification", {
                message: "⚠️ Gagal menyimpan ke database Neon PostgreSQL. Periksa log server.",
            });
        }
    }
    onDispose() {
        this.gameTimer?.clear();
        this.botTimer?.clear();
        console.log(`[TowerRoom ${this.state.roomCode}] Room Disposed`);
    }
}
exports.TowerRoom = TowerRoom;
