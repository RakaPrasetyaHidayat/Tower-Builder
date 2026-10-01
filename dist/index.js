"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const colyseus_1 = require("colyseus");
const TowerRoom_1 = require("./rooms/TowerRoom");
const port = Number(process.env.PORT || 2567);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "Tower Builder Colyseus Game Server" });
});
app.get("/api/room/:code", async (req, res) => {
    try {
        const code = req.params.code?.toUpperCase();
        const rooms = await colyseus_1.matchMaker.query({ name: "tower_room" });
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
    }
    catch (error) {
        return res.status(500).json({ error: "Failed to query room" });
    }
});
const server = http_1.default.createServer(app);
const gameServer = new colyseus_1.Server({
    server,
});
gameServer
    .define("tower_room", TowerRoom_1.TowerRoom)
    .filterBy(["roomCode"]);
server.listen(port, () => {
    console.log(`🎮 Tower Builder Colyseus Server running on http://localhost:${port}`);
    console.log(`📡 WebSocket ready on ws://localhost:${port}`);
});
