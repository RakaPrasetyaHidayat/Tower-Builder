import React, { useState } from "react";
import type { GameStateData, BlockPlacePayload } from "../types/game";
import { PhaserTowerGame } from "./PhaserTowerGame";
import type { DropBlockData } from "../game/scenes/TowerScene";
import { LeaderboardSidebar } from "./Leaderboard";
import { Clock, Trophy, Flame, Zap, Snowflake, LogOut, Compass, Landmark, Coins } from "lucide-react";

interface PlayerViewProps {
  state: GameStateData;
  sessionId: string;
  onPlaceBlock: (payload: BlockPlacePayload) => void;
  onLeave: () => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  state,
  sessionId,
  onPlaceBlock,
  onLeave,
}) => {
  const [currentTilt, setCurrentTilt] = useState(0);
  const myPlayer = state.players?.[sessionId];

  const playersList = Object.values(state.players || {}).filter(
    (p) => p.role === "PLAYER"
  );
  playersList.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  const myRank = playersList.findIndex((p) => p.sessionId === sessionId) + 1 || 1;
  const totalPlayers = playersList.length;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const isPlaying = state.status === "PLAYING";
  const isPaused = state.isPaused || state.status === "PAUSED";
  const isLobby = state.status === "LOBBY";
  const isFrozen = Boolean(myPlayer?.isFrozen);

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

  const tiltPercent = Math.min(100, Math.round((Math.abs(currentTilt) / 30) * 100));

  return (
    <div className="min-h-screen bg-stone-950 text-amber-50 flex flex-col p-2 sm:p-4 max-w-5xl mx-auto select-none">
      {/* Top Carved Wooden Banner HUD (Inspired by Tower Reference) */}
      <header className="relative bg-gradient-to-b from-amber-900 via-stone-900 to-stone-950 border-2 border-amber-700/60 rounded-3xl p-3 sm:p-4 mb-2.5 shadow-2xl shadow-black/90 overflow-hidden">
        {/* Decorative corner carvings */}
        <div className="absolute top-1 left-2 text-[10px] font-mono text-amber-500/50">✦ MENARA NUSANTARA ✦</div>

        {/* Top Header Row: BOOSTS button | Wooden Planks Coins Display | MARKET button */}
        <div className="flex items-center justify-between gap-2 mt-2 mb-2">
          {/* Room Code Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 border border-blue-400/50 text-white text-xs font-black shadow-lg shadow-blue-900/40">
            <Landmark className="w-4 h-4 text-blue-300" />
            <span>#{state.roomCode}</span>
          </div>

          {/* Center Carved Wooden Plank Score Plaque */}
          <div className="bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 border-2 border-amber-500/60 rounded-2xl px-4 py-1 text-center shadow-lg shadow-black/60 flex flex-col items-center">
            <div className="text-[10px] text-amber-200/90 font-bold uppercase tracking-wider flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-yellow-300" />
              <span>Upeti Koin:</span>
              <span className="text-yellow-300 font-mono font-black text-sm">{myPlayer?.score || 0}</span>
            </div>
            <div className="text-[10px] text-amber-300/80 font-bold">
              Tingkat: <span className="text-white font-black">{myPlayer?.towerHeight || 0} Lantai</span>
            </div>
          </div>

          {/* Right Action Menu */}
          <div className="flex items-center gap-1.5">
            {/* Timer */}
            <div
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-mono font-black ${
                state.timeRemaining < 30
                  ? "bg-rose-600/30 border-rose-500 text-rose-200 animate-pulse"
                  : "bg-stone-950 border-amber-700/60 text-amber-300"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(state.timeRemaining)}</span>
            </div>

            <button
              type="button"
              onClick={onLeave}
              className="p-1.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-amber-300/70 hover:text-rose-400 transition-all cursor-pointer border border-amber-900/50"
              title="Keluar Arena"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Player Status & Tilt Stability Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-900/50 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-black text-amber-100 truncate max-w-[130px]">
              👤 {myPlayer?.nickname || "Empu"}
            </span>

            <span className="text-yellow-300 font-bold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span>Rank #{myRank}</span>
              <span className="text-amber-400/50 text-[10px]">({totalPlayers} Pemain)</span>
            </span>

            {myPlayer?.combo ? (
              <span className="text-amber-400 font-black flex items-center gap-0.5 animate-bounce">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Combo {myPlayer.combo}x!</span>
              </span>
            ) : null}

            {isFrozen && (
              <span className="px-2 py-0.5 rounded-lg bg-cyan-950 border border-cyan-500/60 text-cyan-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                <Snowflake className="w-3 h-3" />
                <span>ARCA BEKU</span>
              </span>
            )}
          </div>

          {/* Tilt Stability Meter */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="text-[10px] text-amber-300/80 font-bold flex items-center gap-1 shrink-0">
              <Compass className="w-3 h-3 text-amber-400" />
              <span>Tilt:</span>
            </span>
            <div className="flex-1 h-2 bg-stone-950 rounded-full overflow-hidden border border-amber-900/60">
              <div
                className={`h-full transition-all duration-300 ${
                  Math.abs(currentTilt) > 22
                    ? "bg-rose-500"
                    : Math.abs(currentTilt) > 12
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${tiltPercent}%` }}
              />
            </div>
            <span
              className={`font-mono font-black text-[10px] shrink-0 ${
                Math.abs(currentTilt) > 22 ? "text-rose-400" : "text-amber-300"
              }`}
            >
              {currentTilt > 0 ? `+${currentTilt.toFixed(1)}°` : `${currentTilt.toFixed(1)}°`} / 30°
            </span>
          </div>
        </div>

        {/* Multiplier notification banner */}
        {state.scoreMultiplier > 1.0 && (
          <div className="mt-2 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Titah Sultan: Bonus Upeti Skor {state.scoreMultiplier}x Aktif!</span>
          </div>
        )}
      </header>

      {/* Main Grid: Gameplay Canvas + Standings Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1">
        {/* Phaser 3 Pendulum Canvas Game */}
        <main className="lg:col-span-3 relative flex flex-col justify-center">
          <PhaserTowerGame
            isPlaying={isPlaying}
            isPaused={isPaused}
            isFrozen={isFrozen}
            onDropBlock={handleDropBlock}
            onTowerCollapsed={handleTowerCollapsed}
          />

          {/* Lobby Waiting Overlay */}
          {isLobby && (
            <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3 animate-bounce">
                <Landmark className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-xl font-black text-amber-100 mb-1">
                Menanti Titah Mulai Sultan
              </h2>
              <p className="text-xs text-amber-200/70 max-w-xs mb-4">
                Sayembara akan segera dimulai. Pasang mata dan lepaskan tali gantung di saat ayunan tepat di atas candi!
              </p>
              <div className="px-4 py-1.5 rounded-full bg-stone-900 border border-amber-700/60 text-xs text-amber-300 font-mono font-bold">
                Empu Siap Bertanding: {totalPlayers} / 30
              </div>
            </div>
          )}

          {/* Paused Overlay */}
          {isPaused && (
            <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-sm uppercase tracking-wider mb-2">
                Sayembara Dijeda Sultan
              </div>
              <p className="text-xs text-amber-200/70">
                Pertandingan ditunda sejenak oleh Game Master.
              </p>
            </div>
          )}
        </main>

        {/* Live Leaderboard Standings Sidebar */}
        <div className="lg:col-span-1 hidden lg:block">
          <LeaderboardSidebar
            players={playersList}
            currentSessionId={sessionId}
          />
        </div>
      </div>
    </div>
  );
};
