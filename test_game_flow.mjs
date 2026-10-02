import { Client } from "colyseus.js";

async function runTest() {
  console.log("🚀 Testing Tower Builder game flow with Colyseus & Neon PostgreSQL...");

  const client = new Client("ws://localhost:2567");

  console.log("1️⃣ Creating game room as Sultan Hayam Wuruk...");
  const room = await client.create("tower_room", {
    isHost: true,
    nickname: "Sultan Hayam Wuruk",
    roomCode: "TEST" + Math.floor(10 + Math.random() * 90),
  });

  console.log(`✅ Room created! ID: ${room.id}, SessionId: ${room.sessionId}`);

  let dbSavedReceived = false;
  let matchOverReceived = false;

  room.onMessage("feed_notification", (d) => {
    console.log("📢 Feed Notification:", d.message);
  });

  room.onMessage("match_started", (d) => {
    console.log("🏁 Match Started Event received! Time:", d?.timeRemaining);
  });

  room.onMessage("block_event", (d) => {
    console.log(`🧱 Block Event: ${d.nickname} placed floor ${d.height} (Score: ${d.score}, Combo: ${d.combo}x)`);
  });

  room.onMessage("trigger_card_choice", (d) => {
    console.log("🎴 Milestone Pusaka Sakti Triggered! Options count:", d.options.length);
  });

  room.onMessage("match_over", (d) => {
    matchOverReceived = true;
    console.log(`🏆 Match Over! Winner: ${d.winnerNickname} with Score: ${d.winnerScore}`);
  });

  room.onMessage("db_saved", (d) => {
    dbSavedReceived = true;
    console.log(`💾 Neon DB Saved Event! Match ID: ${d.matchId}, Code: ${d.roomCode}, Participants: ${d.participantCount}`);
  });

  // Step 2: Add AI Bots
  console.log("2️⃣ Adding AI Bot Empu...");
  room.send("add_bots");
  await new Promise((r) => setTimeout(r, 1000));

  // Step 3: Start Game
  console.log("3️⃣ Sultan orders: Start Game!");
  room.send("admin_action", { action: "start_game" });
  await new Promise((r) => setTimeout(r, 1000));

  // Step 4: Drop blocks as Sultan
  console.log("4️⃣ Sultan places 5 blocks in a row...");
  for (let i = 1; i <= 5; i++) {
    room.send("drop_block", {
      height: i,
      diff: 0.02,
      width: 170,
      perfect: true,
      isAlive: true,
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  // Step 5: Change multiplier
  console.log("5️⃣ Sultan sets multiplier to 2.0x...");
  room.send("set_multiplier", { multiplier: 2.0 });
  await new Promise((r) => setTimeout(r, 500));

  // Step 6: Wait 2 seconds for bot simulation blocks
  console.log("6️⃣ Waiting for simulated bots to place blocks...");
  await new Promise((r) => setTimeout(r, 3000));

  // Step 7: Force Finish & Save to Neon DB
  console.log("7️⃣ Sultan orders: Force Finish & Save to Neon DB...");
  room.send("force_finish");

  // Wait up to 5 seconds for db_saved event
  for (let i = 0; i < 15; i++) {
    if (dbSavedReceived && matchOverReceived) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  if (dbSavedReceived) {
    console.log("🎉 SUCCESS! Neon PostgreSQL database hit verified successfully!");
  } else {
    console.error("❌ FAILED! Did not receive db_saved event.");
  }

  room.leave();
  process.exit(dbSavedReceived ? 0 : 1);
}

runTest().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
