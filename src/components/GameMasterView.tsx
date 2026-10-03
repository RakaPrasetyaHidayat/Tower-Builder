import React, { useState } from "react";
import type { GameStateData, PlayerData } from "../types/game";
import {
  Crown,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Users,
  Copy,
  Check,
  Zap,
  Clock,
  Layers,
  Award,
  Snowflake,
  Hammer,
} from "lucide-react";

interface GameMasterViewProps {
  state: GameStateData;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetMultiplier: (multiplier: number) => void;
  onEndGame: () => void;
  onResetGame: () => void;
  onLeave: () => void;
}

export const GameMasterView: React.FC<GameMasterViewProps> = ({
  state,
  onStart,
  onPause,
  onResume,
  onSetMultiplier,
  onEndGame,
  onResetGame,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(state.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert players map into sorted array by score
  const playersList: PlayerData[] = Object.values(state.players || {}).filter(
    (p) => p.role === "PLAYER"
  );
  playersList.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  const totalPlayers = playersList.length;
  const alivePlayers = playersList.filter((p) => p.isAlive).length;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col max-w-7xl mx-auto select-none">
      {/* Top Bar: Room Code & Status */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-xl mb-6 shadow-xl">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Game Master Control Deck
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                HOST
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tower Builder Arena
            </h1>
          </div>
        </div>

        {/* 6-Digit Room Code Banner */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-xl w-full md:w-auto justify-between md:justify-start">
          <div className="text-left">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Kode Room (30 Pemain)
            </div>
            <div className="text-2xl font-mono font-black tracking-widest text-sky-400">
              {state.roomCode}
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Salin Kode Room"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Action Exit */}
        <button
          type="button"
          onClick={onLeave}
          className="text-xs font-semibold text-slate-400 hover:text-rose-400 px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all cursor-pointer"
        >
          Keluar Room
        </button>
      </header>

      {/* Main Grid: Control Deck + Live Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Column: GM Control Deck */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status & Timer Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Match Timer (3 Menit)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  state.status === "PLAYING"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : state.status === "PAUSED"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : state.status === "FINISHED"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                }`}
              >
                {state.status}
              </span>
            </div>

            <div className="flex items-center justify-center py-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <Clock className="w-7 h-7 text-sky-400 mr-3 animate-pulse" />
              <span className="text-4xl sm:text-5xl font-mono font-black text-white tracking-wider">
                {formatTimer(state.timeRemaining)}
              </span>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Pemain Bergabung</div>
                <div className="text-lg font-black text-sky-300">
                  {totalPlayers} <span className="text-xs font-normal text-slate-500">/ 30</span>
                </div>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Pemain Masih Hidup</div>
                <div className="text-lg font-black text-emerald-400">
                  {alivePlayers} <span className="text-xs font-normal text-slate-500">/ {totalPlayers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* GM Controls Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Aksi Game Master</span>
            </h2>

            {/* Primary Action Buttons */}
            {state.status === "LOBBY" && (
              <button
                type="button"
                onClick={onStart}
                disabled={totalPlayers === 0}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Mulai Pertandingan Sekarang</span>
              </button>
            )}

            {(state.status === "PLAYING" || state.status === "PAUSED") && (
              <div className="grid grid-cols-2 gap-3">
                {state.isPaused ? (
                  <button
                    type="button"
                    onClick={onResume}
                    className="py-3 px-3 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Lanjutkan Game</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPause}
                    className="py-3 px-3 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-white" />
                    <span>Jeda Game (Pause)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onEndGame}
                  className="py-3 px-3 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Akhiri Match</span>
                </button>
              </div>
            )}

            {state.status === "FINISHED" && (
              <button
                type="button"
                onClick={onResetGame}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-lg shadow-sky-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset & Buat Ronde Baru</span>
              </button>
            )}

            {/* Score Multiplier Control */}
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Score Multiplier Event:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1.0, 1.5, 2.0, 3.0].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSetMultiplier(m)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      state.scoreMultiplier === m
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live 30-Player Roster & Leaderboard */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-black text-white">
                Live Roster Pemain ({totalPlayers}/30)
              </h2>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total Balok: {state.totalBlocksPlaced}</span>
            </div>
          </div>

          {/* Players Table / List */}
          <div className="flex-1 overflow-y-auto max-h-[560px] pr-1 space-y-2">
            {playersList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <Users className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada pemain yang bergabung</p>
                <p className="text-xs text-slate-600 mt-1">
                  Bagikan kode <span className="font-mono text-sky-400">{state.roomCode}</span> kepada peserta
                </p>
              </div>
            ) : (
              playersList.map((player, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={player.sessionId}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      !player.isAlive
                        ? "bg-slate-950/40 border-slate-900 opacity-60"
                        : rank === 1
                        ? "bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/30"
                        : "bg-slate-950/70 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Rank badge */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                          rank === 1
                            ? "bg-amber-400 text-slate-950"
                            : rank === 2
                            ? "bg-slate-300 text-slate-950"
                            : rank === 3
                            ? "bg-amber-700 text-amber-100"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {rank === 1 ? <Award className="w-4 h-4" /> : rank}
                      </div>

                      {/* Nickname, combo, and statuses */}
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-bold text-sm text-white">
                            {player.nickname}
                          </span>
                          {!player.isAlive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-bold tracking-wide">
                              RUNTUH
                            </span>
                          )}
                          {player.isFrozen && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold flex items-center gap-1">
                              <Snowflake className="w-3 h-3" /> BEKU
                            </span>
                          )}
                          {player.budgetBlocksRemaining && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold flex items-center gap-1">
                              <Hammer className="w-3 h-3" /> EFISIENSI {player.budgetBlocksRemaining}
                            </span>
                          )}
                          {player.hasBLT && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold flex items-center gap-1">
                              <Zap className="w-3 h-3" /> BLT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Tinggi: {player.towerHeight} Balok</span>
                          {player.combo > 0 && player.isAlive && (
                            <span className="text-sky-400 font-semibold">
                              • Combo {player.combo}x
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="text-base font-black text-emerald-400 font-mono">
                        {player.score.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Points</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
