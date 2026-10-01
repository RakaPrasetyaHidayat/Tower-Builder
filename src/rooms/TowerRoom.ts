import { Room, Client, Delayed } from "colyseus";
import { GameState, PlayerState } from "./schema/GameState";
import { prisma } from "../db";
import { Role } from "@prisma/client";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export type CardType = "DOUBLE_FUNDS" | "AUTO_CRANE" | "LAND_DISPUTE" | "CORRUPTION";

export class TowerRoom extends Room<GameState> {
  maxClients = 31; // 1 Game Master + 30 Players
  private gameTimer?: Delayed;

  onCreate(options: { roomCode?: string; nickname?: string; isHost?: boolean }) {
    // Prevent ghost room creation by joining players with invalid room code
    if (options.isHost === false) {
      throw new Error("Kode Room Sayembara tidak ditemukan atau sudah berakhir.");
    }

    this.setState(new GameState());
    this.state.roomCode = (options.roomCode || generateRoomCode()).toUpperCase();
    this.setMetadata({ roomCode: this.state.roomCode });

    // 1. Handling "drop_block"
    this.onMessage("drop_block", (client, data: {
      height: number;
      diff: number;
      width: number;
      perfect: boolean;
      isAlive: boolean;
    }) => {
      if (this.state.status !== "PLAYING" || this.state.isPaused) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.role !== "PLAYER" || !player.isAlive) return;

      const now = Date.now();

      // Cek status freeze
      if (player.isFrozen) {
        if (now < player.frozenUntil) {
          client.send("action_rejected", { reason: "Anda sedang terkena kutukan arca batu!" });
          return;
        } else {
          player.isFrozen = false;
        }
      }

      // Cek Auto-Crane Buff
      let isPerfect = data.perfect;
      if (player.hasAutoCrane) {
        isPerfect = true;
        player.hasAutoCrane = false;
      }

      player.towerHeight = data.height;
      player.isAlive = data.isAlive;
      player.lastPlacedAt = now;

      if (isPerfect) {
        player.combo += 1;
      } else {
        player.combo = 0;
      }

      // Hitung skor dasar * multiplier global & buff Double Funds
      const basePoints = 100;
      const comboBonus = player.combo * 50;
      let multiplier = this.state.scoreMultiplier;

      if (now < player.doubleFundsUntil) {
        multiplier *= 2.0;
      }

      const pointsEarned = data.isAlive ? Math.round((basePoints + comboBonus) * multiplier) : 0;
      player.score += pointsEarned;
      this.state.totalBlocksPlaced += 1;

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
      let playerCount = 0;
      this.state.players.forEach((p) => {
        if (p.role === "PLAYER") {
          playerCount++;
          if (p.isAlive) anyPlayerAlive = true;
        }
      });

      if (!anyPlayerAlive && playerCount > 0) {
        this.finishMatch();
      }
    });

    // 2. Handling "select_card"
    this.onMessage("select_card", (client, data: { cardType: CardType; targetSessionId?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;

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
          if (!data.targetSessionId) return;
          const target = this.state.players.get(data.targetSessionId);
          if (target && target.role === "PLAYER" && target.isAlive) {
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
          if (!data.targetSessionId) return;
          const target = this.state.players.get(data.targetSessionId);
          if (target && target.role === "PLAYER") {
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

    // 3. Handling "admin_action"
    this.onMessage("admin_action", (client, data: {
      action: "start_game" | "pause_game" | "resume_game" | "freeze_player" | "reset_match";
      targetSessionId?: string;
    }) => {
      if (client.sessionId !== this.state.gameMasterSessionId) {
        client.send("error", { message: "Aksi hanya diizinkan untuk Sultan (Game Master)" });
        return;
      }

      switch (data.action) {
        case "start_game": {
          if (this.state.status === "PLAYING") return;
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
          if (!data.targetSessionId) return;
          const target = this.state.players.get(data.targetSessionId);
          if (target) {
            target.isFrozen = !target.isFrozen;
            target.frozenUntil = target.isFrozen ? Date.now() + 10000 : 0;
            this.broadcast("feed_notification", {
              message: target.isFrozen
                ? `⚡ Sultan mengutuk ${target.nickname} menjadi arca beku!`
                : `✨ Sultan melepas kutukan ${target.nickname}.`,
            });

            if (target.isFrozen) {
              this.clock.setTimeout(() => {
                if (target.isFrozen && Date.now() >= target.frozenUntil) {
                  target.isFrozen = false;
                }
              }, 10000);
            }
          }
          break;
        }

        case "reset_match": {
          this.gameTimer?.clear();
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

    this.onMessage("set_multiplier", (client, data: { multiplier: number }) => {
      if (client.sessionId !== this.state.gameMasterSessionId) return;
      if (typeof data.multiplier === "number" && data.multiplier > 0) {
        this.state.scoreMultiplier = Number(data.multiplier.toFixed(1));
        this.broadcast("multiplier_updated", { multiplier: this.state.scoreMultiplier });
      }
    });

    this.onMessage("start_game", (client) => {
      if (client.sessionId === this.state.gameMasterSessionId) {
        this.broadcast("match_started");
        this.state.status = "PLAYING";
      }
    });
  }

  onJoin(client: Client, options: { isHost?: boolean; nickname?: string }) {
    const isFirstPlayer = this.clients.length === 1;
    const isGameMaster = Boolean(options.isHost || isFirstPlayer);

    if (!isGameMaster && this.clients.length > 31) {
      throw new Error("Room penuh (Maksimal 30 Pemain + 1 Sultan)");
    }

    const player = new PlayerState();
    player.id = client.id;
    player.sessionId = client.sessionId;
    player.nickname = options.nickname?.trim() || (isGameMaster ? "Sultan Hayam Wuruk" : `Empu_${client.sessionId.slice(-4)}`);
    player.role = isGameMaster ? "GAME_MASTER" : "PLAYER";

    if (isGameMaster) {
      this.state.gameMasterSessionId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);
    console.log(`[TowerRoom ${this.state.roomCode}] ${player.role} Joined: ${player.nickname}`);
  }

  onLeave(client: Client, _consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    console.log(`[TowerRoom ${this.state.roomCode}] Left: ${player.nickname}`);

    if (player.role === "GAME_MASTER") {
      let candidateSessionId = "";
      this.state.players.forEach((p, sId) => {
        if (sId !== client.sessionId && !candidateSessionId) {
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

  // 4. Auto-Save Match ke Neon DB & trigger match_over
  private async finishMatch() {
    this.gameTimer?.clear();
    this.state.status = "FINISHED";

    const playersArr = Array.from(this.state.players.values()).filter((p) => p.role === "PLAYER");
    playersArr.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

    const winner = playersArr[0];
    this.state.winnerSessionId = winner ? winner.sessionId : "";

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

    try {
      const gmPlayer = this.state.players.get(this.state.gameMasterSessionId);
      const hostUsername = gmPlayer?.nickname || "Sultan";

      const hostUser = await prisma.user.upsert({
        where: { username: hostUsername },
        update: {},
        create: { username: hostUsername },
      });

      // Make nickname unique per match to avoid constraint collisions
      const seenNames = new Set<string>();

      const match = await prisma.match.create({
        data: {
          roomCode: this.state.roomCode,
          status: "FINISHED",
          hostId: hostUser.id,
          durationSeconds: 180 - this.state.timeRemaining,
          participants: {
            create: await Promise.all(
              playersArr.map(async (p, idx) => {
                let uniqueNick = p.nickname;
                if (seenNames.has(uniqueNick)) {
                  uniqueNick = `${p.nickname} (#${p.sessionId.slice(-3)})`;
                }
                seenNames.add(uniqueNick);

                const user = await prisma.user.upsert({
                  where: { username: uniqueNick },
                  update: {},
                  create: { username: uniqueNick },
                });

                return {
                  userId: user.id,
                  nickname: uniqueNick,
                  role: Role.PLAYER,
                  score: p.score,
                  towerHeight: p.towerHeight,
                  rank: idx + 1,
                };
              })
            ),
          },
        },
      });

      console.log(`[Prisma / Neon DB] Match ${match.roomCode} tersimpan ke DB (ID: ${match.id})`);
    } catch (error) {
      console.error("[Prisma / Neon DB] Gagal menyimpan data match:", error);
    }
  }

  onDispose() {
    this.gameTimer?.clear();
    console.log(`[TowerRoom ${this.state.roomCode}] Room Disposed`);
  }
}
