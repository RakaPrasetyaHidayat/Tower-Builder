import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") sessionId: string = "";
  @type("string") nickname: string = "Player";
  @type("string") role: "GAME_MASTER" | "PLAYER" = "PLAYER";
  @type("number") score: number = 0;
  @type("number") towerHeight: number = 0;
  @type("number") combo: number = 0;
  @type("boolean") isAlive: boolean = true;
  @type("boolean") isReady: boolean = false;
  @type("number") lastPlacedAt: number = 0;

  // Buff & Sabotage State
  @type("boolean") isFrozen: boolean = false;
  @type("number") frozenUntil: number = 0;
  @type("number") doubleFundsUntil: number = 0;
  @type("boolean") hasAutoCrane: boolean = false;
}

export class GameState extends Schema {
  @type("string") roomCode: string = "";
  @type("string") gameMasterSessionId: string = "";
  @type("string") status: "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED" = "LOBBY";
  @type("number") timeRemaining: number = 180;
  @type("number") scoreMultiplier: number = 1.0;
  @type("boolean") isPaused: boolean = false;
  @type("number") totalBlocksPlaced: number = 0;
  @type("string") winnerSessionId: string = "";

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
