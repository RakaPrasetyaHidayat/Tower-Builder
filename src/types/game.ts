export type UserRole = "GAME_MASTER" | "PLAYER";

export type MatchStatus = "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";

export type CardType = "DOUBLE_FUNDS" | "AUTO_CRANE" | "LAND_DISPUTE" | "CORRUPTION";

export interface CardOption {
  type: CardType;
  category: "BUFF" | "SABOTASE";
  name: string;
  description: string;
}

export interface PlayerData {
  id: string;
  sessionId: string;
  nickname: string;
  role: UserRole;
  score: number;
  towerHeight: number;
  combo: number;
  isAlive: boolean;
  isReady: boolean;
  lastPlacedAt: number;
  isFrozen?: boolean;
  frozenUntil?: number;
  doubleFundsUntil?: number;
  hasAutoCrane?: boolean;
}

export interface GameStateData {
  roomCode: string;
  gameMasterSessionId: string;
  status: MatchStatus;
  timeRemaining: number;
  scoreMultiplier: number;
  isPaused: boolean;
  totalBlocksPlaced: number;
  winnerSessionId: string;
  players: Record<string, PlayerData>;
}

export interface BlockPlacePayload {
  height: number;
  diff: number;
  width: number;
  perfect: boolean;
  isAlive: boolean;
  scoreAdded?: number;
  combo?: number;
}

export interface DbSavedPayload {
  matchId: string;
  roomCode: string;
  participantCount: number;
  savedAt: string;
  winner?: string;
}

