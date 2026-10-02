import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");
client.joinOrCreate("tower_room", { nickname: "Test" }).then(room => {
    console.log("Joined room:", room.id);
    
    room.onStateChange.once((state) => {
        console.log("State roomCode:", state.roomCode);
        console.log("State players size:", state.players ? state.players.size : 'undefined');
        
        let players = [];
        if (state.players && typeof state.players.forEach === "function") {
            state.players.forEach((p, key) => {
                players.push(p.nickname);
            });
        }
        console.log("Players from forEach:", players);
        
        process.exit(0);
    });
}).catch(e => {
    console.error(e);
    process.exit(1);
});
