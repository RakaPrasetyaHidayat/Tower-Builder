import { useState, useEffect, useCallback } from "react";
import type { Room } from "colyseus.js";
import { createGameRoom, joinGameRoom } from "./services/colyseus";
import type { GameStateData, BlockPlacePayload, CardOption, CardType } from "./types/game";
import { Lobby } from "./components/Lobby";
import { AdminDashboard } from "./components/AdminDashboard";
import { PlayerView } from "./components/PlayerView";
import { CardChoiceModal } from "./components/CardChoiceModal";
import { MatchSummaryModal } from "./components/Leaderboard";

export function App() {
  const [room, setRoom] = useState<Room<any> | null>(null);
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Round key to trigger game canvas reset on new round
  const [roundId, setRoundId] = useState<number>(1);
  // Card Choice modal state
  const [cardChoices, setCardChoices] = useState<CardOption[] | null>(null);
  // Match Summary modal visible flag
  const [showSummary, setShowSummary] = useState<boolean>(false);
  // Toast notifications feed
  const [feedNotification, setFeedNotification] = useState<string | null>(null);

  const setupRoomListeners = useCallback((activeRoom: Room<any>) => {
    const syncState = (state: any) => {
      if (!state || !state.players) return;

      const playersObj: Record<string, any> = {};
      state.players.forEach((player: any, key: string) => {
        playersObj[key] = {
          id: player.id,
          sessionId: player.sessionId,
          nickname: player.nickname,
          role: player.role,
          score: player.score,
          towerHeight: player.towerHeight,
          combo: player.combo,
          isAlive: player.isAlive,
          isReady: player.isReady,
          lastPlacedAt: player.lastPlacedAt,
          isFrozen: player.isFrozen,
          frozenUntil: player.frozenUntil,
          doubleFundsUntil: player.doubleFundsUntil,
          hasAutoCrane: player.hasAutoCrane,
        };
      });

      if (state.status === "FINISHED") {
        setShowSummary(true);
      }

      setGameState({
        roomCode: state.roomCode,
        gameMasterSessionId: state.gameMasterSessionId,
        status: state.status,
        timeRemaining: state.timeRemaining,
        scoreMultiplier: state.scoreMultiplier,
        isPaused: state.isPaused,
        totalBlocksPlaced: state.totalBlocksPlaced,
        winnerSessionId: state.winnerSessionId,
        players: playersObj,
      });
    };

    activeRoom.onStateChange(syncState);
    if (activeRoom.state) {
      syncState(activeRoom.state);
    }

    // Milestone card choice event
    activeRoom.onMessage("trigger_card_choice", (data: { options: CardOption[] }) => {
      setCardChoices(data.options);
    });

    // Sabotage / Feed notification event
    activeRoom.onMessage("feed_notification", (data: { message: string }) => {
      setFeedNotification(data.message);
      setTimeout(() => setFeedNotification(null), 4000);
    });

    activeRoom.onMessage("match_over", () => {
      setShowSummary(true);
    });

    activeRoom.onMessage("match_reset", () => {
      setShowSummary(false);
      setCardChoices(null);
      setRoundId((prev) => prev + 1);
    });

    activeRoom.onMessage("action_rejected", (data: { reason: string }) => {
      setFeedNotification(data.reason);
      setTimeout(() => setFeedNotification(null), 3000);
    });

    activeRoom.onLeave(() => {
      setRoom(null);
      setGameState(null);
      setIsLoading(false);
      setCardChoices(null);
      setShowSummary(false);
    });

    activeRoom.onError((code, message) => {
      setError(`Koneksi error (${code}): ${message || "Tidak dapat terhubung ke server"}`);
      setIsLoading(false);
    });
  }, []);

  const handleCreate = async (nickname: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newRoom = await createGameRoom(nickname);
      setRoom(newRoom);
      setupRoomListeners(newRoom);
    } catch (err: any) {
      setError(err?.message || "Gagal membuat room Sultan. Pastikan server Colyseus berjalan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (roomCode: string, nickname: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const joinedRoom = await joinGameRoom(roomCode, nickname);
      setRoom(joinedRoom);
      setupRoomListeners(joinedRoom);
    } catch (err: any) {
      setError(err?.message || "Gagal bergabung ke room. Pastikan kode room 6 digit benar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    if (room) {
      room.leave();
    }
    setRoom(null);
    setGameState(null);
    setCardChoices(null);
    setShowSummary(false);
  };

  // Admin actions
  const handleStart = () =>
    room?.send("admin_action", { action: "start_game" });
  const handlePause = () =>
    room?.send("admin_action", { action: "pause_game" });
  const handleResume = () =>
    room?.send("admin_action", { action: "resume_game" });
  const handleResetGame = () => {
    setShowSummary(false);
    setCardChoices(null);
    setRoundId((prev) => prev + 1);
    room?.send("admin_action", { action: "reset_match" });
  };
  const handleFreezePlayer = (targetSessionId: string) => {
    room?.send("admin_action", { action: "freeze_player", targetSessionId });
  };
  const handleSetMultiplier = (multiplier: number) =>
    room?.send("set_multiplier", { multiplier });

  // Player drop block
  const handlePlaceBlock = (payload: BlockPlacePayload) => {
    room?.send("drop_block", {
      height: payload.height,
      diff: payload.diff,
      width: payload.width,
      perfect: payload.perfect,
      isAlive: payload.isAlive,
    });
  };

  // Player select card
  const handleSelectCard = (cardType: CardType, targetSessionId?: string) => {
    room?.send("select_card", { cardType, targetSessionId });
    setCardChoices(null);
  };

  useEffect(() => {
    return () => {
      if (room) room.leave();
    };
  }, [room]);

  if (!room || !gameState) {
    return (
      <Lobby
        onCreate={handleCreate}
        onJoin={handleJoin}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  const mySessionId = room.sessionId;
  const isGameMaster =
    gameState.gameMasterSessionId === mySessionId ||
    gameState.players?.[mySessionId]?.role === "GAME_MASTER";

  return (
    <>
      {/* Toast Notification Banner */}
      {feedNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-stone-900/95 border-2 border-amber-500/60 backdrop-blur-md text-amber-200 text-xs font-bold shadow-2xl shadow-black/80 animate-bounce">
          {feedNotification}
        </div>
      )}

      {/* Card Selection Modal (Milestone 5 Balok) */}
      {cardChoices && (
        <CardChoiceModal
          options={cardChoices}
          players={Object.values(gameState.players || {})}
          currentSessionId={mySessionId}
          onSelect={handleSelectCard}
          onClose={() => setCardChoices(null)}
        />
      )}

      {/* Match Over Summary Modal */}
      {showSummary && (
        <MatchSummaryModal
          players={Object.values(gameState.players || {})}
          roomCode={gameState.roomCode}
          currentSessionId={mySessionId}
          isGameMaster={isGameMaster}
          onRestart={isGameMaster ? handleResetGame : undefined}
          onClose={() => setShowSummary(false)}
        />
      )}

      {isGameMaster ? (
        <AdminDashboard
          state={gameState}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onSetMultiplier={handleSetMultiplier}
          onFreezePlayer={handleFreezePlayer}
          onResetGame={handleResetGame}
          onLeave={handleLeave}
        />
      ) : (
        <PlayerView
          key={roundId}
          state={gameState}
          sessionId={mySessionId}
          onPlaceBlock={handlePlaceBlock}
          onLeave={handleLeave}
        />
      )}
    </>
  );
}

export default App;
