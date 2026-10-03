import React, { useState, useRef } from "react";
import type { GameStateData, BlockPlacePayload, Question, QuestionResult } from "../types/game";
import { PhaserTowerGame, type PhaserTowerGameHandle } from "./PhaserTowerGame";
import type { DropBlockData } from "../game/scenes/TowerScene";
import { QuestionOverlay } from "./QuestionOverlay";
import {
  Clock, Trophy, Flame, Snowflake, LogOut, Landmark, Coins, Hammer,
  Play, Crown, Bot, LayoutDashboard, Zap,
} from "lucide-react";

interface PlayerViewProps {
  state: GameStateData;
  sessionId: string;
  isGameMaster?: boolean;
  onPlaceBlock: (payload: BlockPlacePayload) => void;
  onLeave: () => void;
  onStart?: (durationSeconds?: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onSetMultiplier?: (multiplier: number) => void;
  onForceFinish?: () => void;
  onAddBots?: () => void;
  onSwitchToDashboard?: () => void;
  currentQuestion?: Question | null;
  questionResult?: QuestionResult | null;
  onAnswerQuestion?: (questionId: number, answerIndex: number) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  state,
  sessionId,
  isGameMaster = false,
  onPlaceBlock,
  onLeave,
  onStart,
  onPause: _onPause,
  onResume,
  onSetMultiplier: _onSetMultiplier,
  onForceFinish: _onForceFinish,
  onAddBots,
  onSwitchToDashboard,
  currentQuestion,
  questionResult,
  onAnswerQuestion,
}) => {
  const [currentTilt, setCurrentTilt] = useState(0);
  const gameRef = useRef<PhaserTowerGameHandle | null>(null);

  const myPlayer = state.players?.[sessionId];

  const playersList = Object.values(state.players || {});
  playersList.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  const myRank = playersList.findIndex((p) => p.sessionId === sessionId) + 1 || 1;
  const top5 = playersList.slice(0, 5);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const isPlaying = state.status === "PLAYING";
  const isPaused = state.isPaused || state.status === "PAUSED";
  const isLobby = state.status === "LOBBY";
  const isFinished = state.status === "FINISHED";
  const isFrozen = Boolean(myPlayer?.isFrozen);
  const isQuestionMode = state.gameMode === "question_building";
  // Boleh tap drop hanya jika: bukan question mode, ATAU question mode dan canPlaceBlock=true
  const canDrop = !isQuestionMode || Boolean(myPlayer?.canPlaceBlock);

  const handleDropBlock = (data: DropBlockData) => {
    setCurrentTilt(data.tiltSum);
    onPlaceBlock({
      height: data.currentHeight,
      diff: data.offsetRatio,
      width: 170,
      perfect: data.perfect,
      isAlive: data.isAlive,
    });
  };

  const handleTowerCollapsed = (data: { height: number; tiltSum: number }) => {
    setCurrentTilt(data.tiltSum);
    onPlaceBlock({
      height: data.height,
      diff: 999,
      width: 0,
      perfect: false,
      isAlive: false,
    });
  };

  const triggerMobileDrop = () => {
    if (gameRef.current) {
      gameRef.current.triggerDrop();
    }
  };

  // Listen for spacebar globally
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying && !isPaused && !isFrozen && canDrop) {
          triggerMobileDrop();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isPaused, isFrozen, canDrop]);

  const lastDropRef = useRef(0);
  const handleTapDrop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Debounce: ignore if fired within 100ms (prevents touchstart + click double-fire)
    const now = Date.now();
    if (now - lastDropRef.current < 100) return;
    lastDropRef.current = now;

    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur();
    }
    if (isPlaying && !isPaused && !isFrozen && canDrop) {
      triggerMobileDrop();
    }
  };

  // Tilt danger level
  const tiltAbs = Math.abs(currentTilt);
  const tiltDanger = tiltAbs > 22 ? "critical" : tiltAbs > 12 ? "warning" : "safe";

  // Status helpers for leaderboard
  const getPlayerStatus = (p: typeof playersList[0]) => {
    if (!p.isAlive) return { label: "Runtuh", color: "text-rose-400", bg: "bg-rose-500/20" };
    if (p.isFrozen) return { label: "Sabotase", color: "text-cyan-300", bg: "bg-cyan-500/20" };
    if (p.doubleFundsUntil && p.doubleFundsUntil > Date.now()) return { label: "2x Upeti", color: "text-amber-300", bg: "bg-amber-500/20" };
    if (p.hasAutoCrane) return { label: "Auto-Crane", color: "text-emerald-300", bg: "bg-emerald-500/20" };
    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-900 select-none overflow-hidden">
      {/* Full-screen Game Canvas */}
      <div className="absolute inset-0">
        <PhaserTowerGame
          ref={gameRef}
          isPlaying={isPlaying}
          isPaused={isPaused}
          isFrozen={isFrozen}
          initialHeight={myPlayer?.towerHeight || 0}
          onDropBlock={handleDropBlock}
          onTowerCollapsed={handleTowerCollapsed}
        />
      </div>

      {/* ═══════ FLOATING HUD OVERLAYS ═══════ */}

      {/* Central Status Alerts */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
        {isFrozen && (
          <div className="px-6 py-3 rounded-3xl bg-cyan-950/80 backdrop-blur-md border-2 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center gap-3 animate-pulse">
            <Snowflake className="w-8 h-8 text-cyan-300 animate-spin" style={{ animationDuration: "3s" }} />
            <div className="text-center">
              <div className="text-cyan-100 font-black text-xl tracking-widest uppercase">Tersabotase!</div>
              <div className="text-cyan-300/80 text-[10px] font-bold">KUTUKAN ARCA BEKU</div>
            </div>
          </div>
        )}
        {myPlayer?.hasAutoCrane && (
          <div className="px-4 py-2 rounded-2xl bg-emerald-950/80 backdrop-blur-md border border-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center gap-2">
            <Hammer className="w-5 h-5 text-emerald-400 animate-bounce" />
            <span className="text-emerald-100 font-black text-sm uppercase">Auto-Crane Aktif</span>
          </div>
        )}
      </div>

      {/* Top-Left: Score & Timer Pill */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-2">
        {/* Score */}
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Coins className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Upeti</div>
            <div className="text-lg font-black text-white font-mono leading-tight">
              {(myPlayer?.score || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Timer */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-md text-xs font-mono font-black ${
            state.timeRemaining < 30
              ? "bg-rose-500/30 border-rose-400/40 text-rose-200 animate-pulse"
              : "bg-black/40 border-white/10 text-white/80"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTimer(state.timeRemaining)}</span>
        </div>

        {/* Tilt Indicator */}
        {isPlaying && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
            <div className="relative w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                  tiltDanger === "critical" ? "bg-rose-500" : tiltDanger === "warning" ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, (tiltAbs / 30) * 100)}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-bold ${
              tiltDanger === "critical" ? "text-rose-400" : "text-white/60"
            }`}>
              {currentTilt > 0 ? "+" : ""}{currentTilt.toFixed(1)}°
            </span>
          </div>
        )}
      </div>

      {/* Top-Right: Leaderboard Overlay */}
      <div className="absolute top-3 right-3 z-30 w-48 sm:w-56">
        <div className="bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
          {/* Leaderboard Header */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-black text-white/80 uppercase tracking-wider">Peringkat</span>
          </div>

          {/* Top 5 Players */}
          <div className="p-1.5 space-y-0.5">
            {top5.map((player, idx) => {
              const rank = idx + 1;
              const isMe = player.sessionId === sessionId;
              const status = getPlayerStatus(player);

              return (
                <div
                  key={player.sessionId}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all ${
                    isMe ? "bg-amber-500/20 border border-amber-400/30" : "hover:bg-white/5"
                  }`}
                >
                  {/* Rank Badge */}
                  <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                    rank === 1 ? "bg-amber-400 text-slate-900"
                    : rank === 2 ? "bg-slate-300 text-slate-900"
                    : rank === 3 ? "bg-amber-700 text-white"
                    : "bg-white/10 text-white/50"
                  }`}>
                    {rank}
                  </span>

                  {/* Name & Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-[11px] font-bold truncate ${isMe ? "text-amber-200" : "text-white/70"}`}>
                        {player.nickname}
                      </span>
                      {player.role === "GAME_MASTER" && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                    {status && (
                      <span className={`text-[9px] font-bold ${status.color} flex items-center gap-0.5`}>
                        {status.label === "Sabotase" && <Snowflake className="w-2.5 h-2.5" />}
                        {status.label === "2x Upeti" && <Zap className="w-2.5 h-2.5" />}
                        {status.label}
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <span className={`text-[11px] font-mono font-bold shrink-0 ${isMe ? "text-amber-300" : "text-white/50"}`}>
                    {player.score.toLocaleString()}
                  </span>
                </div>
              );
            })}

            {/* Own rank if not in top 5 */}
            {myRank > 5 && myPlayer && (
              <>
                <div className="text-center text-white/20 text-[10px] py-0.5">• • •</div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/30">
                  <span className="w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center bg-white/10 text-white/50 shrink-0">
                    {myRank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-amber-200 truncate block">{myPlayer.nickname}</span>
                    {getPlayerStatus(myPlayer) && (
                      <span className={`text-[9px] font-bold ${getPlayerStatus(myPlayer)!.color}`}>
                        {getPlayerStatus(myPlayer)!.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-300 shrink-0">
                    {myPlayer.score.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top-Center: Room Code (tiny pill) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
          <Landmark className="w-3 h-3 text-amber-400/70" />
          <span className="text-[10px] font-mono font-bold text-white/50">#{state.roomCode}</span>
        </div>
      </div>

      {/* Bottom-Center: Combo / Frozen Status */}
      {isPlaying && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
          {myPlayer?.combo && myPlayer.combo > 1 ? (
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-orange-500/30 backdrop-blur-md border border-orange-400/40 animate-bounce">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-black text-orange-200">Kombo {myPlayer.combo}x!</span>
            </div>
          ) : null}

          {isFrozen && (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-500/30 backdrop-blur-md border border-cyan-400/40 animate-pulse">
              <Snowflake className="w-5 h-5 text-cyan-300" />
              <span className="text-sm font-black text-cyan-200">Tersabotase!</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom: Tap-to-Drop Zone — hanya tampil jika boleh drop */}
      {isPlaying && !isPaused && !isFrozen && canDrop && (
        <div className="absolute bottom-0 left-0 right-0 z-30 p-3">
          <button
            type="button"
            onClick={handleTapDrop}
            onTouchStart={handleTapDrop}
            className="w-full py-4 rounded-2xl font-black text-sm text-white/90 bg-white/10 backdrop-blur-md border border-white/15 active:bg-white/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Hammer className="w-5 h-5 text-amber-400" />
            <span>KETUK UNTUK MENARUH BALOK</span>
          </button>
        </div>
      )}

      {/* Question Building overlay — tampil di atas game canvas */}
      {isPlaying && !isPaused && isQuestionMode && onAnswerQuestion && (
        <QuestionOverlay
          question={currentQuestion ?? null}
          result={questionResult ?? null}
          canPlaceBlock={canDrop}
          onAnswer={onAnswerQuestion}
        />
      )}

      {/* GM Controls (small floating pills) */}
      {isGameMaster && (
        <div className="absolute bottom-3 left-3 z-30 flex flex-col gap-1.5">
          {onSwitchToDashboard && (
            <button
              type="button"
              onClick={onSwitchToDashboard}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white/60 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white/40 hover:text-rose-400 text-[11px] font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Non-GM Leave Button */}
      {!isGameMaster && (
        <div className="absolute bottom-3 left-3 z-30">
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white/40 hover:text-rose-400 text-[11px] font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ═══════ FULL-SCREEN OVERLAYS ═══════ */}

      {/* Lobby Waiting Overlay */}
      {isLobby && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mb-4 animate-bounce">
            <Landmark className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">
            {isGameMaster ? "Sayembara Siap Dimulai" : "Menanti Titah Sultan"}
          </h2>
          <p className="text-sm text-white/50 max-w-xs mb-6">
            {isGameMaster
              ? "Tekan tombol di bawah untuk mulai bertanding."
              : "Sultan akan segera memulai pertandingan."}
          </p>

          {isGameMaster ? (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {onStart && (
                <button
                  type="button"
                  onClick={onStart}
                  className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Mulai Sayembara</span>
                </button>
              )}
              {onAddBots && (
                <button
                  type="button"
                  onClick={onAddBots}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white/70 bg-white/10 border border-white/10 hover:bg-white/15 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tambah Bot (AI)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="px-5 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-white/60 font-mono font-bold">
              {playersList.length} / 30 Pemain Siap
            </div>
          )}
        </div>
      )}

      {/* Paused Overlay */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
          <div className="px-6 py-3 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 font-black text-lg uppercase tracking-wider mb-3">
            Sayembara Dijeda
          </div>
          <p className="text-sm text-white/40 mb-4">Pertandingan ditunda oleh Sultan.</p>
          {isGameMaster && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-black text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Lanjutkan</span>
            </button>
          )}
        </div>
      )}

      {/* Finished Overlay */}
      {isFinished && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
          <Trophy className="w-12 h-12 text-amber-400 mb-3" />
          <h2 className="text-2xl font-black text-white mb-1">Sayembara Selesai!</h2>
          <p className="text-sm text-white/50 mb-4">
            Peringkat Anda: <span className="text-amber-400 font-black">#{myRank}</span> • Skor: <span className="text-amber-400 font-black">{myPlayer?.score || 0}</span>
          </p>
          <button
            type="button"
            onClick={onLeave}
            className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/70 font-bold text-sm cursor-pointer hover:bg-white/15 transition-all"
          >
            Keluar
          </button>
        </div>
      )}
    </div>
  );
};
