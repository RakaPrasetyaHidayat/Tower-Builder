import http from "http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { TowerRoom } from "./rooms/TowerRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Tower Builder Colyseus Game Server" });
});

app.get("/api/room/:code", async (req, res) => {
  try {
    const code = req.params.code?.toUpperCase();
    const rooms = await matchMaker.query({ name: "tower_room" });
    const match = rooms.find((r) => r.metadata?.roomCode === code);

    if (!match) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json({
      roomId: match.roomId,
      roomCode: match.metadata?.roomCode,
      clients: match.clients,
      maxClients: match.maxClients,
      locked: match.locked,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to query room" });
  }
});

const server = http.createServer(app);
const gameServer = new Server({
  server,
});

gameServer
  .define("tower_room", TowerRoom)
  .filterBy(["roomCode"]);

server.listen(port, () => {
  console.log(`🎮 Tower Builder Colyseus Server running on http://localhost:${port}`);
  console.log(`📡 WebSocket ready on ws://localhost:${port}`);
});
