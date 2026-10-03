import { useState, useEffect, useCallback, useRef } from "react";
import type { Room } from "colyseus.js";
import { createGameRoom, generateClientRoomCode, joinGameRoom, reconnectGameRoom } from "./services/colyseus";
import type { GameStateData, BlockPlacePayload, CardOption, CardType, DbSavedPayload, GameMode, Question, QuestionResult } from "./types/game";
import { Lobby } from "./components/Lobby";
import { AdminDashboard } from "./components/AdminDashboard";
import { PlayerView } from "./components/PlayerView";
import { CardChoiceModal } from "./components/CardChoiceModal";
import { MatchSummaryModal } from "./components/Leaderboard";
import type { CustomQuestion } from "./components/QuestionManager";

// Bersihkan URL ?room= param tanpa reload
function consumeUrlRoomParam(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoom = urlParams.get("room");
  if (urlRoom) {
    // Hapus param dari URL agar tidak re-trigger reconnect pada refresh berikutnya
    urlParams.delete("room");
    const newSearch = urlParams.toString();
    window.history.replaceState(null, "", newSearch ? `?${newSearch}` : window.location.pathname);
  }
  return urlRoom?.toUpperCase() || null;
}

// Cek apakah ada session tersimpan sebelum render pertama
function hasSavedSession(): boolean {
  const hasStorage = !!(
    sessionStorage.getItem("tb_room_code") &&
    sessionStorage.getItem("tb_nickname")
  );
  // Kalau ada ?room= di URL dan ada nickname tersimpan, juga perlu loading
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoom = urlParams.get("room");
  const hasUrlRoom = !!(urlRoom && sessionStorage.getItem("tb_nickname"));
  return hasStorage || hasUrlRoom;
}

function clearSessionStorage() {
  sessionStorage.removeItem("tb_room_code");
  sessionStorage.removeItem("tb_nickname");
  sessionStorage.removeItem("tb_reconnect_token");
  sessionStorage.removeItem("tb_role");
  sessionStorage.removeItem("tb_gm_view_mode");
}

export function App() {
  const [room, setRoom] = useState<Room<any> | null>(null);
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  // Mulai dengan isLoading=true jika ada session tersimpan, agar Lobby tidak flash
  const [isLoading, setIsLoading] = useState<boolean>(hasSavedSession());
  const [error, setError] = useState<string | null>(null);

  const [roundId, setRoundId] = useState<number>(1);
  const [cardChoices, setCardChoices] = useState<CardOption[] | null>(null);
  const [autoPlaceRequest, setAutoPlaceRequest] = useState(0);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [feedNotification, setFeedNotification] = useState<string | null>(null);
  const [dbSavedInfo, setDbSavedInfo] = useState<DbSavedPayload | null>(null);
  const [gmViewMode, setGmViewMode] = useState<"play" | "dashboard">("dashboard");

  // Question Building state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionResult, setQuestionResult] = useState<QuestionResult | null>(null);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [customQuestionsSaved, setCustomQuestionsSaved] = useState(false);

  // Ref ke room aktif — dipakai di cleanup tanpa menyebabkan re-render
  const roomRef = useRef<Room<any> | null>(null);
  const restoreStartedRef = useRef(false);
  // Flag agar onLeave tidak clear state saat kita sendiri yang keluar
  const isLeavingRef = useRef(false);

  const changeGmViewMode = (mode: "play" | "dashboard") => {
    sessionStorage.setItem("tb_gm_view_mode", mode);
    setGmViewMode(mode);
  };

  const setupRoomListeners = useCallback((activeRoom: Room<any>) => {
    const syncState = (state: any) => {
      if (!state) return;

      // Selalu simpan roomCode ke sessionStorage setiap ada update
      if (state.roomCode) {
        sessionStorage.setItem("tb_room_code", state.roomCode);
      }

      const playersObj: Record<string, any> = {};
      if (state.players) {
        if (typeof state.players.forEach === "function") {
          state.players.forEach((player: any, key: string) => {
            if (player) {
              playersObj[key] = {
                id: player.id || key,
                sessionId: player.sessionId || key,
                nickname: player.nickname || "Pemain",
                role: player.role || "PLAYER",
                score: player.score ?? 0,
                towerHeight: player.towerHeight ?? 0,
                combo: player.combo ?? 0,
                isAlive: player.isAlive ?? true,
                isReady: player.isReady ?? false,
                lastPlacedAt: player.lastPlacedAt ?? 0,
                isFrozen: Boolean(player.isFrozen),
                frozenUntil: player.frozenUntil ?? 0,
                budgetBlocksRemaining: player.budgetBlocksRemaining ?? 0,
                hasBLT: Boolean(player.hasBLT),
              };
            }
          });
        } else if (typeof state.players === "object") {
          Object.entries(state.players).forEach(([key, player]: [string, any]) => {
            if (player) {
              playersObj[key] = {
                id: player.id || key,
                sessionId: player.sessionId || key,
                nickname: player.nickname || "Pemain",
                role: player.role || "PLAYER",
                score: player.score ?? 0,
                towerHeight: player.towerHeight ?? 0,
                combo: player.combo ?? 0,
                isAlive: player.isAlive ?? true,
                isReady: player.isReady ?? false,
                lastPlacedAt: player.lastPlacedAt ?? 0,
                isFrozen: Boolean(player.isFrozen),
                frozenUntil: player.frozenUntil ?? 0,
                budgetBlocksRemaining: player.budgetBlocksRemaining ?? 0,
                hasBLT: Boolean(player.hasBLT),
              };
            }
          });
        }
      }

      if (state.status === "FINISHED") {
        setShowSummary(true);
      }

      setGameState({
        roomCode: state.roomCode || "",
        gameMasterSessionId: state.gameMasterSessionId || "",
        status: state.status || "LOBBY",
        timeRemaining: state.timeRemaining ?? 180,
        scoreMultiplier: state.scoreMultiplier ?? 1.0,
        isPaused: Boolean(state.isPaused),
        totalBlocksPlaced: state.totalBlocksPlaced ?? 0,
        winnerSessionId: state.winnerSessionId || "",
        gameMode: (state.gameMode as GameMode) || "fast_building",
        players: playersObj,
      });
    };

    activeRoom.onStateChange(syncState);
    // Sync state awal yang sudah ada
    if (activeRoom.state) syncState(activeRoom.state);

    activeRoom.onMessage("trigger_card_choice", (data: { options: CardOption[] }) => {
      setCardChoices(data.options);
    });
    activeRoom.onMessage("custom_questions", (data: { questions: CustomQuestion[] }) => {
      setCustomQuestions(data.questions);
      setCustomQuestionsSaved(true);
    });
    activeRoom.onMessage("card_applied", (data: { cardType: CardType }) => {
      if (data.cardType === "LIQUID_BUDGET") {
        setAutoPlaceRequest((request) => request + 1);
      }
    });
    activeRoom.onMessage("feed_notification", (data: { message: string }) => {
      setFeedNotification(data.message);
      setTimeout(() => setFeedNotification(null), 4000);
    });
    activeRoom.onMessage("db_saved", (data: DbSavedPayload) => {
      setDbSavedInfo(data);
      setFeedNotification(`💾 Match #${data.roomCode} sukses tersimpan ke Database Neon PostgreSQL!`);
      setTimeout(() => setFeedNotification(null), 5000);
    });
    activeRoom.onMessage("match_over", () => setShowSummary(true));
    activeRoom.onMessage("match_reset", () => {
      setShowSummary(false);
      setCardChoices(null);
      setDbSavedInfo(null);
      setRoundId((prev) => prev + 1);
    });
    activeRoom.onMessage("action_rejected", (data: { reason: string }) => {
      setFeedNotification(data.reason);
      setTimeout(() => setFeedNotification(null), 3000);
    });

    // Question Building messages
    activeRoom.onMessage("new_question", (data: Question) => {
      setQuestionResult(null);
      setCurrentQuestion(data);
    });

    activeRoom.onMessage("question_result", (data: QuestionResult) => {
      setQuestionResult(data);
      if (data.correct) {
        // Soal berikutnya datang setelah blok ditempatkan (dari server)
        // Hapus soal agar tombol tap-drop muncul
        setCurrentQuestion(null);
      }
      // Jika salah, soal baru akan datang setelah 3 detik (dari server)
      if (!data.correct) {
        setTimeout(() => setQuestionResult(null), 3000);
      }
    });
    activeRoom.send("get_custom_questions");

    // Koneksi putus dari luar (bukan karena kita yang keluar)
    activeRoom.onLeave((code) => {
      if (isLeavingRef.current) return;
      roomRef.current = null;
      setRoom(null);
      setGameState(null);
      setIsLoading(false);
      setCardChoices(null);
      setShowSummary(false);
      setDbSavedInfo(null);
      setError(`Koneksi sayembara terputus (${code}). Muat ulang halaman untuk mencoba menyambung kembali.`);
    });

    activeRoom.onError((code, message) => {
      setError(`Koneksi error (${code}): ${message || "Tidak dapat terhubung ke server"}`);
      setIsLoading(false);
    });
  }, []);

  // ── Reconnect saat refresh ──────────────────────────────────────────────
  useEffect(() => {
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;

    // Konsumsi URL ?room= param (hapus dari URL agar tidak loop pada refresh berikutnya)
    const urlRoomCode = consumeUrlRoomParam();

    const savedRoomCode = sessionStorage.getItem("tb_room_code") || urlRoomCode;
    const savedNickname = sessionStorage.getItem("tb_nickname");
    const savedToken = sessionStorage.getItem("tb_reconnect_token");
    const savedRole = sessionStorage.getItem("tb_role");

    // Tidak ada session sama sekali → tidak perlu reconnect, tampilkan lobby
    if (!savedRoomCode || !savedNickname) {
      setIsLoading(false);
      return;
    }

    // Sudah ada room aktif → skip
    if (roomRef.current) return;

    const restoreSession = async () => {
      try {
        let activeRoom: Room<any> | null = null;

        // 1. Coba reconnect pakai token (restore session persis yang sama)
        if (savedToken) {
          try {
            activeRoom = await reconnectGameRoom(savedToken);
          } catch {
            // Token expired/invalid → lanjut fallback
          }
        }

        // 2. Fallback: join room yang ada via roomId (tidak buat room baru)
        if (!activeRoom) {
          try {
            activeRoom = await joinGameRoom(savedRoomCode, savedNickname);
          } catch {
            activeRoom = null;
          }
        }

        if (!activeRoom) {
          // Bersihkan session agar refresh berikutnya tidak loop reconnect
          clearSessionStorage();
          setError("Sesi sayembara sudah berakhir. Buat atau bergabung ke sayembara baru.");
          setIsLoading(false);
          return;
        }

        // Simpan token baru
        sessionStorage.setItem("tb_reconnect_token", activeRoom.reconnectionToken || "");
        setError(null);

        // Restore tampilan sesuai role
        if (savedRole === "GAME_MASTER") {
          const savedViewMode = sessionStorage.getItem("tb_gm_view_mode");
          changeGmViewMode(savedViewMode === "play" ? "play" : "dashboard");
        } else {
          setGmViewMode("play");
        }

        roomRef.current = activeRoom;
        setRoom(activeRoom);
        setupRoomListeners(activeRoom);
      } catch {
        // Bersihkan session agar refresh berikutnya tidak loop reconnect
        clearSessionStorage();
        setError("Terjadi kendala saat menyambung kembali. Periksa koneksi lalu coba muat ulang lagi.");
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya run sekali saat mount

  // ── Create (GM) ──────────────────────────────────────────────────────────
  const handleCreate = async (nickname: string) => {
    setIsLoading(true);
    setError(null);
    const roomCode = generateClientRoomCode();
    sessionStorage.setItem("tb_room_code", roomCode);
    sessionStorage.setItem("tb_nickname", nickname);
    sessionStorage.setItem("tb_role", "GAME_MASTER");
    sessionStorage.setItem("tb_gm_view_mode", "dashboard");
    try {
      const newRoom = await createGameRoom(nickname, roomCode);

      // Simpan SEMUA data yang dibutuhkan untuk reconnect SEBELUM setup listeners
      // agar syncState pertama sudah punya nickname
      sessionStorage.setItem("tb_reconnect_token", newRoom.reconnectionToken || "");
      sessionStorage.setItem("tb_room_code", newRoom.state?.roomCode || roomCode);

      changeGmViewMode("dashboard");
      roomRef.current = newRoom;
      setRoom(newRoom);
      setupRoomListeners(newRoom);
      // roomCode akan disimpan otomatis saat syncState pertama masuk dari server
    } catch (err: any) {
      clearSessionStorage();
      setError(err?.message || "Gagal membuat room. Pastikan server Colyseus berjalan di port 2567.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Join (Player) ────────────────────────────────────────────────────────
  const handleJoin = async (roomCode: string, nickname: string) => {
    setIsLoading(true);
    setError(null);
    sessionStorage.setItem("tb_room_code", roomCode.toUpperCase());
    sessionStorage.setItem("tb_nickname", nickname);
    sessionStorage.setItem("tb_role", "PLAYER");
    try {
      const joinedRoom = await joinGameRoom(roomCode, nickname);
      sessionStorage.setItem("tb_room_code", roomCode.toUpperCase());
      sessionStorage.setItem("tb_reconnect_token", joinedRoom.reconnectionToken || "");
      sessionStorage.removeItem("tb_gm_view_mode");
      setGmViewMode("play");
      roomRef.current = joinedRoom;
      setRoom(joinedRoom);
      setupRoomListeners(joinedRoom);
    } catch (err: any) {
      clearSessionStorage();
      setError(err?.message || "Gagal bergabung. Pastikan kode room 6 digit benar.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Leave ────────────────────────────────────────────────────────────────
  const handleLeave = () => {
    isLeavingRef.current = true;

    clearSessionStorage();

    const currentRoom = roomRef.current;
    roomRef.current = null;
    if (currentRoom) {
      try { currentRoom.leave(); } catch { /* noop */ }
    }

    setRoom(null);
    setGameState(null);
    setCardChoices(null);
    setShowSummary(false);
    setDbSavedInfo(null);
    setError(null);
    setGmViewMode("dashboard");
    setCurrentQuestion(null);
    setQuestionResult(null);

    setTimeout(() => { isLeavingRef.current = false; }, 300);
  };

  // ── Admin actions ────────────────────────────────────────────────────────
  const handleStart = (durationSeconds?: number) =>
    room?.send("admin_action", { action: "start_game", durationSeconds: durationSeconds ?? 180 });
  const handlePause = () =>
    room?.send("admin_action", { action: "pause_game" });
  const handleResume = () =>
    room?.send("admin_action", { action: "resume_game" });
  const handleResetGame = () => {
    setShowSummary(false);
    setCardChoices(null);
    setDbSavedInfo(null);
    setCurrentQuestion(null);
    setQuestionResult(null);
    setRoundId((prev) => prev + 1);
    room?.send("admin_action", { action: "reset_match" });
  };
  const handleFreezePlayer = (targetSessionId: string) =>
    room?.send("admin_action", { action: "freeze_player", targetSessionId });
  const handleSetMultiplier = (multiplier: number) =>
    room?.send("set_multiplier", { multiplier });
  const handleForceFinish = () => room?.send("force_finish");
  const handleAddBots = () => room?.send("add_bots");

  const handleSetGameMode = (mode: GameMode) =>
    room?.send("admin_action", { action: "set_game_mode", gameMode: mode });

  const handleSaveCustomQuestions = (questions: CustomQuestion[]) =>
    room?.send("set_custom_questions", { questions });

  const handleCustomQuestionsChange = (questions: CustomQuestion[]) => {
    setCustomQuestions(questions);
    setCustomQuestionsSaved(false);
  };

  const handleAnswerQuestion = (questionId: number, answerIndex: number) =>
    room?.send("answer_question", { questionId, answerIndex });

  const handlePlaceBlock = (payload: BlockPlacePayload) =>
    room?.send("drop_block", {
      height: payload.height,
      diff: payload.diff,
      width: payload.width,
      perfect: payload.perfect,
      isAlive: payload.isAlive,
    });

  const handleSelectCard = (cardType: CardType, targetSessionId?: string) => {
    room?.send("select_card", { cardType, targetSessionId });
    setCardChoices(null);
  };

  // ── Cleanup saat component unmount (tutup tab/browser) ───────────────────
  useEffect(() => {
    return () => {
      // Jangan leave saat unmount normal (React StrictMode double-invoke, HMR, dll)
      // Hanya leave kalau user benar-benar tutup tab (pakai beforeunload)
    };
  }, []);

  // Simpan roomCode ke sessionStorage setiap kali gameState berubah
  useEffect(() => {
    if (gameState?.roomCode) {
      sessionStorage.setItem("tb_room_code", gameState.roomCode);
    }
    // Simpan role GM
    if (room && gameState) {
      const mySessionId = room.sessionId;
      const isGM =
        gameState.gameMasterSessionId === mySessionId ||
        gameState.players?.[mySessionId]?.role === "GAME_MASTER";
      if (isGM) {
        sessionStorage.setItem("tb_role", "GAME_MASTER");
      }
    }
  }, [gameState, room]);

  // ── Render ───────────────────────────────────────────────────────────────

  // Tampilkan loading screen saat sedang reconnect (jangan flash ke Lobby)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🏛️</span>
        </div>
        <p className="text-amber-200 font-bold text-sm">Menghubungkan ke Sayembara...</p>
        <p className="text-slate-500 text-xs">Memulihkan sesi permainan</p>
      </div>
    );
  }

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
      {feedNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-stone-900/95 border-2 border-amber-500/60 backdrop-blur-md text-amber-200 text-xs font-bold shadow-2xl shadow-black/80 animate-bounce text-center max-w-md">
          {feedNotification}
        </div>
      )}

      {cardChoices && (
        <CardChoiceModal
          options={cardChoices}
          players={Object.values(gameState.players || {})}
          currentSessionId={mySessionId}
          onSelect={handleSelectCard}
          onClose={() => setCardChoices(null)}
        />
      )}

      {showSummary && (
        <MatchSummaryModal
          players={Object.values(gameState.players || {})}
          roomCode={gameState.roomCode}
          currentSessionId={mySessionId}
          isGameMaster={isGameMaster}
          dbSavedInfo={dbSavedInfo}
          onRestart={isGameMaster ? handleResetGame : undefined}
          onClose={() => setShowSummary(false)}
        />
      )}

      {isGameMaster && gmViewMode === "dashboard" ? (
        <AdminDashboard
          state={gameState}
          dbSavedInfo={dbSavedInfo}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onSetMultiplier={handleSetMultiplier}
          onFreezePlayer={handleFreezePlayer}
          onResetGame={handleResetGame}
          onForceFinish={handleForceFinish}
          onAddBots={handleAddBots}
          onSetGameMode={handleSetGameMode}
          customQuestions={customQuestions}
          customQuestionsSaved={customQuestionsSaved}
          onCustomQuestionsChange={handleCustomQuestionsChange}
          onSetCustomQuestions={handleSaveCustomQuestions}
          onSwitchToPlay={() => changeGmViewMode("play")}
          onLeave={handleLeave}
        />
      ) : (
        <PlayerView
          key={roundId}
          state={gameState}
          sessionId={mySessionId}
          autoPlaceRequest={autoPlaceRequest}
          isGameMaster={isGameMaster}
          onPlaceBlock={handlePlaceBlock}
          onLeave={handleLeave}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onSetMultiplier={handleSetMultiplier}
          onForceFinish={handleForceFinish}
          onAddBots={handleAddBots}
          onSwitchToDashboard={isGameMaster ? () => changeGmViewMode("dashboard") : undefined}
          currentQuestion={currentQuestion}
          questionResult={questionResult}
          onAnswerQuestion={handleAnswerQuestion}
        />
      )}
    </>
  );
}

export default App;
