"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = exports.PlayerState = void 0;
const schema_1 = require("@colyseus/schema");
class PlayerState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.id = "";
        this.sessionId = "";
        this.nickname = "Player";
        this.role = "PLAYER";
        this.score = 0;
        this.towerHeight = 0;
        this.combo = 0;
        this.isAlive = true;
        this.isReady = false;
        this.lastPlacedAt = 0;
        // Buff & Sabotage State
        this.isFrozen = false;
        this.frozenUntil = 0;
        this.budgetBlocksRemaining = 0;
        this.hasBLT = false;
        // Question Building mode
        this.canPlaceBlock = true; // false = jawaban salah, tunggu jeda
        this.currentQuestionIdx = 0; // index pertanyaan saat ini
    }
}
exports.PlayerState = PlayerState;
(0, schema_1.defineTypes)(PlayerState, {
    id: "string",
    sessionId: "string",
    nickname: "string",
    role: "string",
    score: "number",
    towerHeight: "number",
    combo: "number",
    isAlive: "boolean",
    isReady: "boolean",
    lastPlacedAt: "number",
    isFrozen: "boolean",
    frozenUntil: "number",
    budgetBlocksRemaining: "number",
    hasBLT: "boolean",
    canPlaceBlock: "boolean",
    currentQuestionIdx: "number",
});
class GameState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.roomCode = "";
        this.gameMasterSessionId = "";
        this.status = "LOBBY";
        this.timeRemaining = 180;
        this.scoreMultiplier = 1.0;
        this.isPaused = false;
        this.totalBlocksPlaced = 0;
        this.winnerSessionId = "";
        this.gameMode = "fast_building";
        this.players = new schema_1.MapSchema();
    }
}
exports.GameState = GameState;
(0, schema_1.defineTypes)(GameState, {
    roomCode: "string",
    gameMasterSessionId: "string",
    status: "string",
    timeRemaining: "number",
    scoreMultiplier: "number",
    isPaused: "boolean",
    totalBlocksPlaced: "number",
    winnerSessionId: "string",
    gameMode: "string",
    players: { map: PlayerState }
});
