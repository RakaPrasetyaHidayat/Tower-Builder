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

export type CardType =
  | "BUDGET_EFFICIENCY"
  | "LIQUID_BUDGET"
  | "BLT"
  | "CORRUPTION"
  | "STALLED_PROJECT"
  | "BUILDING_EVICTION";
export type GameMode = "fast_building" | "question_building";
const FREEZE_DURATION_MS = 5000;

// ── Bank soal pertanyaan ────────────────────────────────────────────────────
export interface Question {
  id: number;
  text: string;
  options: string[];      // 4 pilihan
  correctIndex: number;   // index jawaban benar (0-3)
  category: string;
}

// Acak soal tanpa pengulangan per sesi
function shuffleQuestions(questions: Question[]): Question[] {
  const arr = [...questions];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── TowerRoom ───────────────────────────────────────────────────────────────
export class TowerRoom extends Room<GameState> {
  maxClients = 31;
  private gameTimer?: Delayed;
  private botTimer?: Delayed;

  // Per-player question queues (sessionId → shuffled question list)
  private playerQuestions = new Map<string, Question[]>();
  private customQuestions: Question[] = [];
  // Track apakah jawaban terakhir player benar (untuk syarat card choice di QB mode)
  private playerLastAnswerCorrect = new Map<string, boolean>();
  private blockScoreLedger = new Map<string, number[]>();
  private pendingBlockDrops = new Map<string, number>();

  onCreate(options: { roomCode?: string; nickname?: string }) {
    this.setState(new GameState());
    this.state.roomCode = (options.roomCode || generateRoomCode()).toUpperCase();
    this.setMetadata({ roomCode: this.state.roomCode });

    this.onMessage("get_custom_questions", (client) => {
      if (client.sessionId === this.state.gameMasterSessionId) {
        client.send("custom_questions", { questions: this.customQuestions });
      }
    });

    this.onMessage("set_custom_questions", (client, data: { questions?: unknown }) => {
      if (client.sessionId !== this.state.gameMasterSessionId) {
        client.send("action_rejected", { reason: "Hanya Sultan yang dapat mengatur soal." });
        return;
      }
      if (this.state.status !== "LOBBY") {
        client.send("action_rejected", { reason: "Soal hanya dapat diubah saat masih di lobby." });
        return;
      }
      if (!Array.isArray(data?.questions) || data.questions.length > 500) {
        client.send("action_rejected", { reason: "Daftar soal tidak valid." });
        return;
      }

      const questions = data.questions as Partial<Question>[];
      const valid = questions.every((question) =>
        Boolean(question) && typeof question === "object" &&
        typeof question.text === "string" && question.text.trim().length > 0 && question.text.length <= 500 &&
        Array.isArray(question.options) && question.options.length === 4 &&
        question.options.every((option) => typeof option === "string" && option.trim().length > 0 && option.length <= 200) &&
        Number.isInteger(question.correctIndex) && question.correctIndex! >= 0 && question.correctIndex! < 4 &&
        typeof question.category === "string" && question.category.length <= 80
      );
      if (!valid) {
        client.send("action_rejected", { reason: "Lengkapi pertanyaan, empat pilihan, kategori, dan jawaban benar." });
        return;
      }

      this.customQuestions = questions.map((question, index) => ({
        id: index + 1,
        text: question.text!.trim(),
        options: question.options!.map((option) => option.trim()),
        correctIndex: question.correctIndex!,
        category: question.category!.trim() || "Umum",
      }));
      this.playerQuestions.clear();
      client.send("custom_questions", { questions: this.customQuestions });
    });

    this.onMessage("block_drop_started", (client) => {
      if (this.state.status !== "PLAYING" || this.state.isPaused) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive || player.isFrozen) return;
      if (this.state.gameMode === "question_building" && !player.canPlaceBlock) return;
      this.pendingBlockDrops.set(client.sessionId, Date.now());
    });

    // ── drop_block ─────────────────────────────────────────────────────────
    this.onMessage("drop_block", (client, data: {
      height: number; diff: number; width: number; perfect: boolean; isAlive: boolean;
    }) => {
      if (this.state.status !== "PLAYING" || this.state.isPaused) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;

      const now = Date.now();
      const dropStartedAt = this.pendingBlockDrops.get(client.sessionId);
      this.pendingBlockDrops.delete(client.sessionId);

      // A block released before a freeze is allowed to finish landing.
      if (player.isFrozen) {
        const freezeExpired = player.frozenUntil > 0 && now >= player.frozenUntil;
        const dropWasAlreadyStarted = dropStartedAt !== undefined && now - dropStartedAt <= 10000;
        if (freezeExpired) {
          player.isFrozen = false;
          player.frozenUntil = 0;
        } else if (!dropWasAlreadyStarted) {
          client.send("action_rejected", { reason: "Anda sedang dibekukan!" });
          return;
        }
      }

      // Question Building: cek apakah player boleh meletakkan blok
      if (this.state.gameMode === "question_building" && !player.canPlaceBlock) {
        client.send("action_rejected", { reason: "Jawab pertanyaan dulu!" });
        return;
      }

      const isPerfect = data.perfect;
      player.towerHeight = data.height;
      player.isAlive = true;
      player.lastPlacedAt = now;

      if (isPerfect) { player.combo += 1; } else { player.combo = 0; }

      const basePoints = 100;
      const comboBonus = player.combo * 50;
      let multiplier = this.state.scoreMultiplier;
      if (player.budgetBlocksRemaining > 0) {
        multiplier *= 2;
        player.budgetBlocksRemaining -= 1;
      }

      const pointsEarned = Math.round((basePoints + comboBonus) * multiplier);
      player.score += pointsEarned;
      const blockScores = this.blockScoreLedger.get(client.sessionId) ?? [];
      blockScores.push(pointsEarned);
      this.blockScoreLedger.set(client.sessionId, blockScores);
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

      // Question Building: after a successful landing, send the next question.
      if (this.state.gameMode === "question_building") {
        player.canPlaceBlock = false;

        // Card choice setiap 5 blok di QB mode hanya untuk blok yang mendarat.
        const blockLanded = Math.abs(data.diff) <= 1.0;
        const lastAnswerCorrect = this.playerLastAnswerCorrect.get(client.sessionId) ?? false;

        if (
          blockLanded &&
          lastAnswerCorrect &&
          player.isAlive &&
          player.towerHeight > 0 &&
          player.towerHeight % 5 === 0
        ) {
          this.sendCardChoice(client, player.towerHeight);
        }

        this.sendNextQuestion(client, player);
      } else {
        // Fast Building: card choice setiap 5 blok
        if (player.isAlive && player.towerHeight > 0 && player.towerHeight % 5 === 0) {
          this.sendCardChoice(client, player.towerHeight);
        }
      }

      let anyPlayerAlive = false;
      this.state.players.forEach((p) => {
        if (p.isAlive && (p.role === "PLAYER" || p.towerHeight > 0)) anyPlayerAlive = true;
      });
      if (!anyPlayerAlive && this.state.players.size > 1) this.finishMatch();
    });

    this.onMessage("blocks_fell", (client, data: { blocksFell: number; isAlive: boolean }) => {
      if (this.state.status !== "PLAYING" && this.state.status !== "PAUSED") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;

      const scores = this.blockScoreLedger.get(client.sessionId) ?? [];
      const requestedLoss = Number.isFinite(data?.blocksFell) ? Math.max(0, Math.floor(data.blocksFell)) : 0;
      const blocksFell = Math.min(requestedLoss, player.towerHeight, scores.length);
      if (blocksFell === 0) return;

      const lostScores = scores.splice(scores.length - blocksFell, blocksFell);
      const pointsLost = lostScores.reduce((sum, score) => sum + score, 0);
      player.towerHeight = Math.max(0, player.towerHeight - blocksFell);
      player.score = Math.max(0, player.score - pointsLost);
      player.combo = 0;
      player.isAlive = Boolean(data.isAlive) && player.towerHeight > 0;
      this.blockScoreLedger.set(client.sessionId, scores);

      this.broadcast("blocks_fell", {
        sessionId: client.sessionId,
        nickname: player.nickname,
        blocksFell,
        pointsLost,
        towerHeight: player.towerHeight,
        score: player.score,
        isAlive: player.isAlive,
      });
      this.broadcast("feed_notification", {
        message: `💥 ${player.nickname} kehilangan ${blocksFell} balok dan ${pointsLost} poin!`,
      });

      let anyPlayerAlive = false;
      this.state.players.forEach((currentPlayer) => {
        if (currentPlayer.isAlive && (currentPlayer.role === "PLAYER" || currentPlayer.towerHeight > 0)) {
          anyPlayerAlive = true;
        }
      });
      if (!anyPlayerAlive && this.state.players.size > 1) this.finishMatch();
    });

    // ── answer_question (Question Building mode) ───────────────────────────
    this.onMessage("answer_question", (client, data: {
      questionId: number;
      answerIndex: number;
    }) => {
      if (this.state.status !== "PLAYING" || this.state.isPaused) return;
      if (this.state.gameMode !== "question_building") return;

      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;

      const questions = this.playerQuestions.get(client.sessionId);
      if (!questions?.length) return;
      const idx = player.currentQuestionIdx % questions.length;
      const question = questions[idx];

      if (!question || question.id !== data.questionId) return;

      const isCorrect = data.answerIndex === question.correctIndex;

      // Simpan hasil jawaban — dipakai saat blok mendarat untuk syarat card choice
      this.playerLastAnswerCorrect.set(client.sessionId, isCorrect);

      if (isCorrect) {
        // Jawaban benar → boleh letakkan blok
        player.canPlaceBlock = true;
        player.currentQuestionIdx += 1;
        client.send("question_result", {
          correct: true,
          correctIndex: question.correctIndex,
          message: "✅ Benar! Susun balok sekarang!",
        });
      } else {
        // Jawaban salah → tidak bisa letakkan blok, jeda 3 detik lalu soal baru
        player.canPlaceBlock = false;
        player.currentQuestionIdx += 1;
        client.send("question_result", {
          correct: false,
          correctIndex: question.correctIndex,
          message: "❌ Salah! Tunggu 3 detik untuk soal berikutnya.",
          penaltyMs: 3000,
        });

        // Setelah 3 detik, kirim soal berikutnya
        this.clock.setTimeout(() => {
          if (player.isAlive && this.state.status === "PLAYING") {
            this.sendNextQuestion(client, player);
          }
        }, 3000);
      }
    });

    // ── select_card ────────────────────────────────────────────────────────
    this.onMessage("select_card", (client, data: { cardType: CardType; targetSessionId?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;

      switch (data.cardType) {
        case "BUDGET_EFFICIENCY": {
          player.budgetBlocksRemaining = 3;
          client.send("card_applied", { cardType: "BUDGET_EFFICIENCY", blocks: 3 });
          this.broadcast("feed_notification", { message: `✨ Efisiensi Anggaran aktif untuk 3 blok ${player.nickname}!` });
          break;
        }
        case "LIQUID_BUDGET": {
          client.send("card_applied", { cardType: "LIQUID_BUDGET", blocks: 2 });
          this.broadcast("feed_notification", { message: `🏗️ Anggaran Cair menyusun 2 blok gratis untuk ${player.nickname}!` });
          break;
        }
        case "BLT": {
          player.hasBLT = true;
          client.send("card_applied", { cardType: "BLT" });
          this.broadcast("feed_notification", { message: `🛡️ BLT melindungi ${player.nickname} dari sabotase berikutnya.` });
          break;
        }
        case "CORRUPTION":
        case "STALLED_PROJECT":
        case "BUILDING_EVICTION": {
          if (!data.targetSessionId || data.targetSessionId === client.sessionId) return;
          const target = this.state.players.get(data.targetSessionId);
          if (!target || !target.isAlive) return;
          this.applySabotage(data.cardType, player, target);
          break;
        }
      }
    });

    // ── set_multiplier ─────────────────────────────────────────────────────
    this.onMessage("set_multiplier", (_client, data: { multiplier: number }) => {
      if (data.multiplier && data.multiplier > 0) {
        this.state.scoreMultiplier = Number(data.multiplier);
        this.broadcast("feed_notification", { message: `⚡ Sultan menetapkan Multiplier Upeti ${this.state.scoreMultiplier}x!` });
      }
    });

    this.onMessage("add_bots", (client) => {
      if (client.sessionId === this.state.gameMasterSessionId) this.addSimulatedBots(5);
    });

    this.onMessage("force_finish", (client) => {
      if (client.sessionId === this.state.gameMasterSessionId) this.finishMatch();
    });

    // ── admin_action ───────────────────────────────────────────────────────
    this.onMessage("admin_action", (client, data: {
      action: string;
      targetSessionId?: string;
      multiplier?: number;
      durationSeconds?: number;
      gameMode?: GameMode;
    }) => {
      if (client.sessionId !== this.state.gameMasterSessionId) {
        client.send("error", { message: "Aksi hanya diizinkan untuk Game Master" });
        return;
      }

      switch (data.action) {
        case "set_game_mode": {
          if (this.state.status !== "LOBBY") return;
          if (data.gameMode === "fast_building" || data.gameMode === "question_building") {
            this.state.gameMode = data.gameMode;
            this.broadcast("feed_notification", {
              message: data.gameMode === "fast_building"
                ? "⚡ Mode: Fast Building (Susun balok secepat mungkin!)"
                : "🧠 Mode: Question Building (Jawab pertanyaan dulu!)",
            });
          }
          break;
        }

        case "start_game": {
          if (this.state.status === "PLAYING") return;
          if (this.state.gameMode === "question_building" && this.customQuestions.length === 0) {
            client.send("action_rejected", { reason: "Buat dan simpan minimal satu soal sebelum memulai Question Building." });
            return;
          }
          this.state.status = "PLAYING";
          this.state.isPaused = false;

          const duration = data.durationSeconds || 180;
          this.state.timeRemaining = duration;

          // Inisialisasi question queue untuk semua player saat game mulai
          if (this.state.gameMode === "question_building") {
            this.state.players.forEach((p, sId) => {
              if (!sId.startsWith("bot_")) {
                p.canPlaceBlock = false; // mulai dengan pertanyaan dulu
                p.currentQuestionIdx = 0;
                this.playerQuestions.set(sId, shuffleQuestions(this.customQuestions));
              }
            });
            // Kirim pertanyaan pertama ke semua player
            this.clients.forEach((c) => {
              const p = this.state.players.get(c.sessionId);
              if (p && p.role !== "GAME_MASTER") {
                this.sendNextQuestion(c, p);
              }
            });
          }

          this.gameTimer?.clear();
          this.gameTimer = this.clock.setInterval(() => {
            if (!this.state.isPaused && this.state.status === "PLAYING") {
              this.state.timeRemaining -= 1;
              if (this.state.timeRemaining <= 0) this.finishMatch();
            }
          }, 1000);

          this.startBotSimulation();
          this.broadcast("match_started", { timeRemaining: duration, gameMode: this.state.gameMode });
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
            if (target.isFrozen) {
              target.isFrozen = false;
              target.frozenUntil = 0;
            } else {
              this.freezePlayer(target);
            }
            this.broadcast("feed_notification", {
              message: target.isFrozen
                ? `Game Master membekukan ${target.nickname} selama 5 detik!`
                : `Game Master melepas pembekuan ${target.nickname}.`,
            });
          }
          break;
        }

        case "set_multiplier": {
          if (data.multiplier && data.multiplier > 0) {
            this.state.scoreMultiplier = Number(data.multiplier);
            this.broadcast("feed_notification", { message: `⚡ Multiplier Upeti diatur ke ${this.state.scoreMultiplier}x!` });
          }
          break;
        }

        case "kick_player": {
          if (!data.targetSessionId) return;
          const tc = this.clients.find(c => c.sessionId === data.targetSessionId);
          const tp = this.state.players.get(data.targetSessionId);
          if (tc && tp) {
            tc.send("kicked_notification", { message: "Anda telah dikeluarkan oleh Game Master." });
            this.broadcast("feed_notification", { message: `🚪 ${tp.nickname} telah dikeluarkan dari ruangan.` });
            tc.leave(4000, "Kicked by Game Master");
          } else if (tp?.sessionId.startsWith("bot_")) {
            this.state.players.delete(data.targetSessionId);
            this.broadcast("feed_notification", { message: `🚪 Bot ${tp.nickname} telah dikeluarkan.` });
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
          this.playerQuestions.clear();
          this.playerLastAnswerCorrect.clear();
          this.blockScoreLedger.clear();
          this.pendingBlockDrops.clear();
          this.state.status = "LOBBY";
          this.state.timeRemaining = 180;
          this.state.scoreMultiplier = 1.0;
          this.state.isPaused = false;
          this.state.totalBlocksPlaced = 0;
          this.state.winnerSessionId = "";
          // Pertahankan gameMode yang sudah dipilih sultan

          this.state.players.forEach((p) => {
            p.score = 0;
            p.towerHeight = 0;
            p.combo = 0;
            p.isAlive = true;
            p.isFrozen = false;
            p.budgetBlocksRemaining = 0;
            p.hasBLT = false;
            p.canPlaceBlock = true;
            p.currentQuestionIdx = 0;
          });

          this.broadcast("match_reset");
          break;
        }
      }
    });

    this.onMessage("start_game", (client) => {
      if (client.sessionId === this.state.gameMasterSessionId) {
        this.broadcast("match_started");
        this.state.status = "PLAYING";
        this.startBotSimulation();
      }
    });
  }

  // ── Kirim pertanyaan ke player ──────────────────────────────────────────
  private sendNextQuestion(client: Client, player: PlayerState) {
    let questions = this.playerQuestions.get(client.sessionId);
    if (!questions) {
      if (this.customQuestions.length === 0) return;
      questions = shuffleQuestions(this.customQuestions);
      this.playerQuestions.set(client.sessionId, questions);
    }

    const idx = player.currentQuestionIdx % questions.length;
    const question = questions[idx];

    client.send("new_question", {
      questionId: question.id,
      text: question.text,
      options: question.options,
      category: question.category,
      questionNumber: player.currentQuestionIdx + 1,
    });
  }

  private applySabotage(cardType: CardType, attacker: PlayerState, target: PlayerState, reflected = false) {
    if (target.hasBLT && !reflected) {
      target.hasBLT = false;
      target.score += 200;
      this.applySabotage(cardType, target, attacker, true);
      this.broadcast("feed_notification", {
        message: `🛡️ BLT memantulkan sabotase ${attacker.nickname} kepada dirinya sendiri; ${target.nickname} menerima 200 poin!`,
      });
      return;
    }

    switch (cardType) {
      case "CORRUPTION": {
        const stolenPoints = Math.min(target.score, Math.max(100, Math.round(target.score * 0.25)));
        target.score -= stolenPoints;
        attacker.score += stolenPoints;
        this.clients.find((client) => client.sessionId === target.sessionId)?.send("sabotage_notification", {
          message: `${attacker.nickname} mengambil ${stolenPoints} poin Upeti Anda!`,
        });
        this.broadcast("feed_notification", { message: `💸 ${attacker.nickname} mengambil ${stolenPoints} poin dari ${target.nickname}!` });
        break;
      }
      case "STALLED_PROJECT": {
        this.freezePlayer(target);
        this.clients.find((client) => client.sessionId === target.sessionId)?.send("sabotage_notification", {
          message: `${attacker.nickname} membekukan proyek Anda selama 5 detik!`,
        });
        this.broadcast("feed_notification", { message: `⏸️ Proyek ${target.nickname} dibekukan oleh ${attacker.nickname} selama 5 detik.` });
        break;
      }
      case "BUILDING_EVICTION": {
        const targetBlocks = this.blockScoreLedger.get(target.sessionId) ?? [];
        const blocksStolen = Math.min(2, target.towerHeight);
        const stolenScores = targetBlocks.splice(Math.max(0, targetBlocks.length - blocksStolen), blocksStolen);
        const stolenPoints = Math.min(target.score, stolenScores.reduce((sum, score) => sum + score, 0));
        target.towerHeight = Math.max(0, target.towerHeight - blocksStolen);
        target.score = Math.max(0, target.score - stolenPoints);
        attacker.score += stolenPoints;
        this.clients.find((client) => client.sessionId === target.sessionId)?.send("tower_blocks_removed", { height: target.towerHeight });
        this.clients.find((client) => client.sessionId === target.sessionId)?.send("sabotage_notification", {
          message: `${attacker.nickname} menertibkan ${blocksStolen} blok menara Anda.`,
        });
        this.broadcast("feed_notification", {
          message: `🚧 ${attacker.nickname} menertibkan ${blocksStolen} blok ${target.nickname} dan mengambil ${stolenPoints} poin!`,
        });
        break;
      }
    }
  }

  private freezePlayer(target: PlayerState) {
    const frozenUntil = Date.now() + FREEZE_DURATION_MS;
    target.isFrozen = true;
    target.frozenUntil = frozenUntil;
    this.clock.setTimeout(() => {
      if (target.frozenUntil !== frozenUntil) return;
      target.isFrozen = false;
      target.frozenUntil = 0;
      this.broadcast("feed_notification", { message: `Pembekuan ${target.nickname} berakhir.` });
    }, FREEZE_DURATION_MS);
  }

  private sendCardChoice(client: Client, height: number) {
    const buffs = [
      { type: "BUDGET_EFFICIENCY", category: "BUFF", name: "Efisiensi Anggaran", description: "Poin dari 3 blok berikutnya menjadi 2x." },
      { type: "LIQUID_BUDGET", category: "BUFF", name: "Anggaran Cair", description: "Dua blok gratis otomatis tersusun dengan presisi sempurna." },
      { type: "BLT", category: "BUFF", name: "BLT (Balasan Langsung Tuntas)", description: "Pantulkan sabotase berikutnya dan dapatkan 200 poin." },
    ];
    const sabotages = [
      { type: "CORRUPTION", category: "SABOTASE", name: "Korupsi", description: "Ambil 25% poin lawan (minimal 100 poin)." },
      { type: "STALLED_PROJECT", category: "SABOTASE", name: "Proyek Mangkrak", description: "Bekukan lawan selama 5 detik." },
      { type: "BUILDING_EVICTION", category: "SABOTASE", name: "Bangunan Ditertibkan", description: "Curi hingga 2 blok teratas beserta poin bloknya." },
    ];
    const randomCard = <T,>(cards: T[]) => cards[Math.floor(Math.random() * cards.length)];

    client.send("trigger_card_choice", {
      height,
      options: [randomCard(buffs), randomCard(sabotages)],
    });
  }

  // ── Bots ────────────────────────────────────────────────────────────────
  private addSimulatedBots(count = 5) {
    const botTemplates = [
      "Empu Gandring (AI)", "Empu Supo (AI)", "Ken Arok (AI)",
      "Patih Gajah Mada (AI)", "Arya Penangsang (AI)",
      "Dyah Pitaloka (AI)", "Prabu Brawijaya (AI)",
    ];
    let added = 0;
    for (let i = 0; i < count; i++) {
      if (this.state.players.size >= 30) break;
      const botId = `bot_${Date.now()}_${i + 1}`;
      const bot = new PlayerState();
      bot.id = botId;
      bot.sessionId = botId;
      bot.nickname = botTemplates[i % botTemplates.length];
      bot.role = "PLAYER";
      bot.isAlive = true;
      bot.isReady = true;
      bot.canPlaceBlock = true;
      this.state.players.set(botId, bot);
      added++;
    }
    this.broadcast("feed_notification", { message: `🤖 ${added} Empu Binaan Kerajaan (AI) masuk ke Arena!` });
  }

  private startBotSimulation() {
    this.botTimer?.clear();
    this.botTimer = this.clock.setInterval(() => {
      if (this.state.status !== "PLAYING" || this.state.isPaused) return;
      const now = Date.now();
      this.state.players.forEach((player, sId) => {
        if (!sId.startsWith("bot_") || !player.isAlive) return;
        if (player.isFrozen) {
          if (player.frozenUntil === 0 || now < player.frozenUntil) return;
          player.isFrozen = false;
          player.frozenUntil = 0;
        }
        if (Math.random() < 0.75) {
          const rand = Math.random();
          if (player.towerHeight > 20 && rand < 0.04) {
            player.isAlive = false;
            this.broadcast("feed_notification", { message: `💥 Candi milik ${player.nickname} runtuh pada tingkat ${player.towerHeight}!` });
            return;
          }
          player.towerHeight += 1;
          const isPerfect = rand > 0.45;
          if (isPerfect) { player.combo += 1; } else { player.combo = 0; }
          let multiplier = this.state.scoreMultiplier;
          if (player.budgetBlocksRemaining > 0) {
            multiplier *= 2;
            player.budgetBlocksRemaining -= 1;
          }
          const pointsEarned = Math.round((100 + player.combo * 50) * multiplier);
          player.score += pointsEarned;
          const blockScores = this.blockScoreLedger.get(player.sessionId) ?? [];
          blockScores.push(pointsEarned);
          this.blockScoreLedger.set(player.sessionId, blockScores);
          this.state.totalBlocksPlaced += 1;
          this.broadcast("block_event", {
            sessionId: player.sessionId, nickname: player.nickname,
            height: player.towerHeight, score: player.score,
            combo: player.combo, perfect: isPerfect, isAlive: player.isAlive,
          });
        }
      });
    }, 2500);
  }

  onJoin(client: Client, options: { isHost?: boolean; nickname?: string }) {
    const isFirstPlayer = this.clients.length === 1;
    const isGameMaster = Boolean(options.isHost || (isFirstPlayer && !this.state.gameMasterSessionId));
    if (!isGameMaster && this.clients.length > 31) throw new Error("Room penuh");

    const player = new PlayerState();
    player.id = client.id;
    player.sessionId = client.sessionId;
    player.nickname = options.nickname?.trim() || (isGameMaster ? "Sultan Keraton" : `Empu_${client.sessionId.slice(-4)}`);
    player.role = isGameMaster ? "GAME_MASTER" : "PLAYER";
    player.canPlaceBlock = true;

    if (isGameMaster) this.state.gameMasterSessionId = client.sessionId;
    this.state.players.set(client.sessionId, player);
    console.log(`[TowerRoom ${this.state.roomCode}] ${player.role} Joined: ${player.nickname}`);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        return;
      } catch { /* reconnect expired */ }
    }

    if (player.role === "GAME_MASTER") {
      let candidate = "";
      this.state.players.forEach((p, sId) => {
        if (sId !== client.sessionId && !sId.startsWith("bot_") && !candidate) candidate = sId;
      });
      if (candidate) {
        const c = this.state.players.get(candidate);
        if (c) { c.role = "GAME_MASTER"; this.state.gameMasterSessionId = candidate; }
      }
    }

    this.playerQuestions.delete(client.sessionId);
    this.playerLastAnswerCorrect.delete(client.sessionId);
    this.pendingBlockDrops.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private async finishMatch() {
    this.gameTimer?.clear();
    this.botTimer?.clear();
    this.state.status = "FINISHED";

    const allPlayers = Array.from(this.state.players.values());
    let playersArr = allPlayers.filter(p => p.towerHeight > 0 || p.score > 0 || p.role === "PLAYER");
    if (playersArr.length === 0 && allPlayers.length > 0) playersArr = [...allPlayers];
    playersArr.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

    const winner = playersArr[0];
    this.state.winnerSessionId = winner?.sessionId || "";

    this.broadcast("match_over", {
      roomCode: this.state.roomCode,
      winnerSessionId: this.state.winnerSessionId,
      winnerNickname: winner?.nickname || "Tidak Ada",
      winnerScore: winner?.score || 0,
      totalBlocks: this.state.totalBlocksPlaced,
      rankings: playersArr.map((p, idx) => ({ rank: idx + 1, nickname: p.nickname, score: p.score, towerHeight: p.towerHeight })),
    });

    try {
      let match: any;
      let participantData: any[] = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const gmPlayer = this.state.players.get(this.state.gameMasterSessionId);
          const hostUsername = gmPlayer?.nickname || "Sultan Keraton";
          const hostUser = await prisma.user.upsert({ where: { username: hostUsername }, update: {}, create: { username: hostUsername } });

          const seenNames = new Set<string>();
          participantData = await Promise.all(playersArr.map(async (p, idx) => {
            let uniqueNick = p.nickname;
            if (seenNames.has(uniqueNick)) uniqueNick = `${uniqueNick} #${idx + 1}`;
            seenNames.add(uniqueNick);
            const user = await prisma.user.upsert({ where: { username: uniqueNick }, update: {}, create: { username: uniqueNick } });
            return { userId: user.id, nickname: uniqueNick, role: p.role === "GAME_MASTER" ? Role.GAME_MASTER : Role.PLAYER, score: p.score, towerHeight: p.towerHeight, rank: idx + 1 };
          }));

          match = await prisma.match.create({
            data: {
              roomCode: this.state.roomCode, status: "FINISHED", hostId: hostUser.id,
              durationSeconds: Math.max(1, 180 - this.state.timeRemaining),
              participants: { create: participantData },
            },
          });
          break;
        } catch (retryErr: any) {
          if (attempt === 3) throw retryErr;
          await new Promise(r => setTimeout(r, 1200));
        }
      }
      this.broadcast("db_saved", { matchId: match.id, roomCode: match.roomCode, participantCount: participantData.length, savedAt: new Date().toISOString(), winner: winner?.nickname || "Tidak Ada" });
      this.broadcast("feed_notification", { message: `💾 Hasil Sayembara #${match.roomCode} sukses tersimpan!` });
    } catch (error) {
      console.error("[DB] Gagal menyimpan:", error);
      this.broadcast("feed_notification", { message: "⚠️ Gagal menyimpan ke database. Periksa log server." });
    }
  }

  onDispose() {
    this.gameTimer?.clear();
    this.botTimer?.clear();
    console.log(`[TowerRoom ${this.state.roomCode}] Disposed`);
  }
}
