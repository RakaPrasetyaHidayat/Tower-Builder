import http from "http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { TowerRoom } from "./rooms/TowerRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

import { prisma } from "./db";

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Tower Builder Colyseus Game Server" });
});

app.get("/api/db/health", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    const matchCount = await prisma.match.count();
    return res.json({
      status: "connected",
      database: "Neon PostgreSQL",
      users: userCount,
      matches: matchCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error?.message || "Database connection failed",
    });
  }
});

app.get("/api/leaderboard", async (_req, res) => {
  try {
    const topParticipants = await prisma.matchParticipant.findMany({
      take: 15,
      orderBy: { score: "desc" },
      include: {
        match: {
          select: {
            roomCode: true,
            createdAt: true,
          },
        },
      },
    });

    return res.json({
      leaderboard: topParticipants.map((p, idx) => ({
        rank: idx + 1,
        nickname: p.nickname,
        score: p.score,
        towerHeight: p.towerHeight,
        roomCode: p.match?.roomCode,
        createdAt: p.joinedAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.get("/api/matches", async (_req, res) => {
  try {
    const matches = await prisma.match.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        host: { select: { username: true } },
        participants: {
          orderBy: { score: "desc" },
          take: 5,
        },
      },
    });

    return res.json({ matches });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch matches" });
  }
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
