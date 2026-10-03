import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

export class PlayerState extends Schema {
  id: string = "";
  sessionId: string = "";
  nickname: string = "Player";
  role: "GAME_MASTER" | "PLAYER" = "PLAYER";
  score: number = 0;
  towerHeight: number = 0;
  combo: number = 0;
  isAlive: boolean = true;
  isReady: boolean = false;
  lastPlacedAt: number = 0;

  // Buff & Sabotage State
  isFrozen: boolean = false;
  frozenUntil: number = 0;
  budgetBlocksRemaining: number = 0;
  hasBLT: boolean = false;

  // Question Building mode
  canPlaceBlock: boolean = true;   // false = jawaban salah, tunggu jeda
  currentQuestionIdx: number = 0;  // index pertanyaan saat ini
}

defineTypes(PlayerState, {
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

export class GameState extends Schema {
  roomCode: string = "";
  gameMasterSessionId: string = "";
  status: "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED" = "LOBBY";
  timeRemaining: number = 180;
  scoreMultiplier: number = 1.0;
  isPaused: boolean = false;
  totalBlocksPlaced: number = 0;
  winnerSessionId: string = "";
  gameMode: "fast_building" | "question_building" = "fast_building";

  players = new MapSchema<PlayerState>();
}

defineTypes(GameState, {
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
