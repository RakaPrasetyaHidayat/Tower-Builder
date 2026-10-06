import React, { useState, useRef, useEffect } from "react";
import type { GameStateData, BlockPlacePayload, Question, QuestionResult } from "../types/game";
import { PhaserTowerGame, type PhaserTowerGameHandle } from "./PhaserTowerGame";
import type { DropBlockData } from "../game/scenes/TowerScene";
import { QuestionOverlay } from "./QuestionOverlay";
import {
  Clock, Trophy, Flame, Snowflake, LogOut, Landmark, Coins, Hammer,
  Play, Crown, LayoutDashboard,
} from "lucide-react";

interface PlayerViewProps {
  state: GameStateData;
  sessionId: string;
  autoPlaceRequest: number;
  onAutoPlaceRequestConsumed: (count: number) => void;
  isGameMaster?: boolean;
  onBlockDropStarted: () => void;
  onBlocksFell: (data: { blocksFell: number; isAlive: boolean }) => void;
  onPlaceBlock: (payload: BlockPlacePayload) => void;
  onLeave: () => void;
  onStart?: (durationSeconds?: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onSetMultiplier?: (multiplier: number) => void;
  onSwitchToDashboard?: () => void;
  currentQuestion?: Question | null;
  questionResult?: QuestionResult | null;
  onAnswerQuestion?: (questionId: number, answerIndex: number) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  state,
  sessionId,
  autoPlaceRequest,
  onAutoPlaceRequestConsumed,
  isGameMaster = false,
  onBlockDropStarted,
  onBlocksFell,
  onPlaceBlock,
  onLeave,
  onStart,
  onPause: _onPause,
  onResume,
  onSetMultiplier: _onSetMultiplier,
  onSwitchToDashboard,
  currentQuestion,
  questionResult,
  onAnswerQuestion,
}) => {
  const [currentTilt, setCurrentTilt] = useState(0);
  const gameRef = useRef<PhaserTowerGameHandle | null>(null);
  useEffect(() => {
    if (autoPlaceRequest <= 0) return;
    gameRef.current?.autoPlaceBlocks(autoPlaceRequest * 2);
    onAutoPlaceRequestConsumed(autoPlaceRequest);
  }, [autoPlaceRequest, onAutoPlaceRequestConsumed]);

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
  const isEliminated = isPlaying && myPlayer?.isAlive === false;
  const isQuestionMode = state.gameMode === "question_building";
  // Boleh tap drop hanya jika: bukan question mode, ATAU question mode dan canPlaceBlock=true
  const canDrop = myPlayer?.isAlive !== false && (!isQuestionMode || Boolean(myPlayer?.canPlaceBlock));

  // Sync isGameActive ke scene saat status berubah
  const prevPlayingRef = useRef(isPlaying);
  useEffect(() => {
    if (prevPlayingRef.current !== isPlaying) {
      prevPlayingRef.current = isPlaying;
      gameRef.current?.setGameActive(isPlaying);
      // Saat game mulai, reset tilt dan sync height
      if (isPlaying) {
        gameRef.current?.resetTiltSum();
        gameRef.current?.syncTowerHeight(myPlayer?.towerHeight || 0);
      }
    }
  }, [isPlaying, myPlayer?.towerHeight]);

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

  const handleTowerCollapsed = (data: { height: number; tiltSum: number; blocksFell: number; isAlive: boolean }) => {
    setCurrentTilt(data.tiltSum);
    onBlocksFell({ blocksFell: data.blocksFell, isAlive: data.isAlive });
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
    if (p.budgetBlocksRemaining) return { label: `Efisiensi x${p.budgetBlocksRemaining}`, color: "text-amber-300", bg: "bg-amber-500/20" };
    if (p.hasBLT) return { label: "BLT Aktif", color: "text-emerald-300", bg: "bg-emerald-500/20" };
    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-900 select-none overflow-hidden">
      {/* Full-screen Game Canvas */}
      <div className="absolute inset-0">
        <PhaserTowerGame
          ref={gameRef}
          isPlaying={isPlaying && myPlayer?.isAlive !== false}
          isPaused={isPaused}
          isFrozen={isFrozen}
          initialHeight={myPlayer?.towerHeight || 0}
          onDropStarted={onBlockDropStarted}
          onDropBlock={handleDropBlock}
          onTowerCollapsed={handleTowerCollapsed}
        />
      </div>

      {/* ═══════ FLOATING HUD OVERLAYS ═══════ */}

      {/* Central Status Alerts — frozen/buff banners */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-none w-max max-w-[90vw]">
        {isFrozen && (
          <div className="px-4 py-2 rounded-2xl bg-cyan-950/90 backdrop-blur-md border-2 border-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.5)] flex items-center gap-2 animate-pulse">
            <Snowflake className="w-5 h-5 text-cyan-300 animate-spin shrink-0" style={{ animationDuration: "3s" }} />
            <div>
              <div className="text-cyan-100 font-black text-sm tracking-widest uppercase">Tersabotase!</div>
              <div className="text-cyan-300/80 text-[9px] font-bold">KUTUKAN ARCA BEKU</div>
            </div>
          </div>
        )}
        {!isFrozen && myPlayer?.budgetBlocksRemaining ? (
          <div className="px-3 py-1.5 rounded-xl bg-amber-950/90 backdrop-blur-md border border-amber-400/50 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-amber-100 font-black text-xs uppercase">Efisiensi: {myPlayer.budgetBlocksRemaining} blok</span>
          </div>
        ) : !isFrozen && myPlayer?.hasBLT ? (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/90 backdrop-blur-md border border-emerald-400/50 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="text-emerald-100 font-black text-xs uppercase">BLT Aktif</span>
          </div>
        ) : null}
      </div>

      {/* Top-Left: Score + Timer stacked */}
      <div className="absolute top-2 left-2 z-30 flex flex-col gap-1.5">
        {/* Score pill */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/10">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
            <Coins className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-[9px] text-white/40 font-semibold uppercase leading-none">Upeti</div>
            <div className="text-sm font-black text-white font-mono leading-tight">
              {(myPlayer?.score || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border backdrop-blur-md text-xs font-mono font-black ${
          state.timeRemaining < 30
            ? "bg-rose-500/30 border-rose-400/40 text-rose-200 animate-pulse"
            : "bg-black/50 border-white/10 text-white/70"
        }`}>
          <Clock className="w-3 h-3 shrink-0" />
          <span>{formatTimer(state.timeRemaining)}</span>
        </div>

        {/* Tilt Indicator */}
        {isPlaying && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
            <div className="relative w-12 h-1.5 rounded-full bg-white/10 overflow-hidden shrink-0">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                  tiltDanger === "critical" ? "bg-rose-500" : tiltDanger === "warning" ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, (tiltAbs / 25) * 100)}%` }}
              />
            </div>
            <span className={`text-[9px] font-mono font-bold ${
              tiltDanger === "critical" ? "text-rose-400" : "text-white/50"
            }`}>
              {currentTilt > 0 ? "+" : ""}{currentTilt.toFixed(1)}°
            </span>
          </div>
        )}
      </div>

      {/* Top-Right: Leaderboard — compact on mobile */}
      <div className="absolute top-2 right-2 z-30 w-36 xs:w-40 sm:w-52">
        <div className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/10">
            <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[10px] font-black text-white/70 uppercase tracking-wider">Peringkat</span>
          </div>
          <div className="p-1 space-y-0.5">
            {top5.map((player, idx) => {
              const rank = idx + 1;
              const isMe = player.sessionId === sessionId;
              const status = getPlayerStatus(player);
              return (
                <div
                  key={player.sessionId}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all ${
                    isMe ? "bg-amber-500/20 border border-amber-400/30" : "hover:bg-white/5"
                  }`}
                >
                  <span className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center shrink-0 ${
                    rank === 1 ? "bg-amber-400 text-slate-900"
                    : rank === 2 ? "bg-slate-300 text-slate-900"
                    : rank === 3 ? "bg-amber-700 text-white"
                    : "bg-white/10 text-white/50"
                  }`}>
                    {rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-0.5">
                      <span className={`text-[10px] font-bold truncate ${isMe ? "text-amber-200" : "text-white/70"}`}>
                        {player.nickname}
                      </span>
                      {player.role === "GAME_MASTER" && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                    </div>
                    {status && (
                      <span className={`text-[8px] font-bold ${status.color}`}>{status.label}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono font-bold shrink-0 ${isMe ? "text-amber-300" : "text-white/50"}`}>
                    {player.score.toLocaleString()}
                  </span>
                </div>
              );
            })}
            {myRank > 5 && myPlayer && (
              <>
                <div className="text-center text-white/20 text-[9px] py-0.5">• • •</div>
                <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30">
                  <span className="w-4 h-4 rounded text-[9px] font-black flex items-center justify-center bg-white/10 text-white/50 shrink-0">
                    {myRank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-amber-200 truncate block">{myPlayer.nickname}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-300 shrink-0">
                    {myPlayer.score.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top-Center: Room Code pill */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
          <Landmark className="w-2.5 h-2.5 text-amber-400/70" />
          <span className="text-[9px] font-mono font-bold text-white/50">#{state.roomCode}</span>
        </div>
      </div>

      {/* Bottom-Center: Combo indicator */}
      {isPlaying && myPlayer?.combo && myPlayer.combo > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-orange-500/30 backdrop-blur-md border border-orange-400/40 animate-bounce">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-black text-orange-200">Kombo {myPlayer.combo}x!</span>
          </div>
        </div>
      )}

      {/* Bottom: Tap-to-Drop button — full width, safe area aware */}
      {isPlaying && !isEliminated && !isPaused && !isFrozen && canDrop && (
        <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleTapDrop}
            onTouchStart={handleTapDrop}
            className="w-full py-4 rounded-2xl font-black text-sm text-white/90 bg-white/10 backdrop-blur-md border border-white/15 active:bg-white/20 active:scale-[0.99] transition-transform flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Hammer className="w-5 h-5 text-amber-400" />
            <span>KETUK UNTUK MENARUH BALOK</span>
          </button>
        </div>
      )}

      {/* Question Building overlay */}
      {isPlaying && !isPaused && isQuestionMode && onAnswerQuestion && (
        <QuestionOverlay
          question={currentQuestion ?? null}
          result={questionResult ?? null}
          canPlaceBlock={canDrop}
          onAnswer={onAnswerQuestion}
        />
      )}

      {/* Bottom-Left controls */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+60px)] left-2 z-30 flex flex-col gap-1.5">
        {isGameMaster && onSwitchToDashboard && (
          <button
            type="button"
            onClick={onSwitchToDashboard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/60 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/40 hover:text-rose-400 text-[10px] font-bold transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ═══════ FULL-SCREEN OVERLAYS ═══════ */}

      {/* Lobby Waiting Overlay */}
      {isLobby && (
        <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mb-4 animate-bounce">
            <Landmark className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">
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
                  onClick={() => onStart()}
                  className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Mulai Sayembara</span>
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
        <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
          <div className="px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 font-black text-base uppercase tracking-wider mb-3">
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
      {isEliminated && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-6 text-center backdrop-blur-sm">
          <div className="max-w-sm rounded-2xl border border-rose-300/25 bg-slate-950/85 px-6 py-5 shadow-2xl">
            <h2 className="text-xl font-black text-rose-200">Menara Runtuh</h2>
            <p className="mt-2 text-sm text-white/70">Anda tersingkir dari ronde ini. Tunggu Sultan memulai ronde baru.</p>
          </div>
        </div>
      )}

      {/* Finished Overlay */}
      {isFinished && (
        <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
          <Trophy className="w-10 h-10 text-amber-400 mb-3" />
          <h2 className="text-xl font-black text-white mb-1">Sayembara Selesai!</h2>
          <p className="text-sm text-white/50 mb-4">
            Peringkat Anda: <span className="text-amber-400 font-black">#{myRank}</span> • Skor: <span className="text-amber-400 font-black">{(myPlayer?.score || 0).toLocaleString()}</span>
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
