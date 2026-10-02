"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = exports.PlayerState = void 0;
const schema_1 = require("@colyseus/schema");
class PlayerState extends schema_1.Schema {
    id = "";
    sessionId = "";
    nickname = "Player";
    role = "PLAYER";
    score = 0;
    towerHeight = 0;
    combo = 0;
    isAlive = true;
    isReady = false;
    lastPlacedAt = 0;
    // Buff & Sabotage State
    isFrozen = false;
    frozenUntil = 0;
    doubleFundsUntil = 0;
    hasAutoCrane = false;
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
    doubleFundsUntil: "number",
    hasAutoCrane: "boolean"
});
class GameState extends schema_1.Schema {
    roomCode = "";
    gameMasterSessionId = "";
    status = "LOBBY";
    timeRemaining = 180;
    scoreMultiplier = 1.0;
    isPaused = false;
    totalBlocksPlaced = 0;
    winnerSessionId = "";
    players = new schema_1.MapSchema();
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
    players: { map: PlayerState }
});
