import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name: string = "Player";
  @type("number") score: number = 0;
  @type("boolean") isReady: boolean = false;
}

export class TowerState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") status: string = "waiting"; // "waiting", "playing", "gameover"
  @type("number") currentTowerHeight: number = 0;
}
