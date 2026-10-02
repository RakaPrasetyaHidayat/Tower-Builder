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
  doubleFundsUntil: number = 0;
  hasAutoCrane: boolean = false;
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
  doubleFundsUntil: "number",
  hasAutoCrane: "boolean"
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
  players: { map: PlayerState }
});
