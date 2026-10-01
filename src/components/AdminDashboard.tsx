import React, { useState } from "react";
import type { GameStateData, PlayerData } from "../types/game";
import {
  Crown,
  Play,
  Pause,
  RotateCcw,
  Users,
  Copy,
  Check,
  Clock,
  Landmark,
  Snowflake,
  Shield,
} from "lucide-react";

interface AdminDashboardProps {
  state: GameStateData;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetMultiplier: (multiplier: number) => void;
  onFreezePlayer: (targetSessionId: string) => void;
  onResetGame: () => void;
  onLeave: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  onStart,
  onPause,
  onResume,
  onSetMultiplier,
  onFreezePlayer,
  onResetGame,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(state.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className="min-h-screen bg-stone-950 text-amber-50 p-4 sm:p-6 flex flex-col max-w-7xl mx-auto select-none">
      {/* Balairung Keraton Header */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-stone-900/90 border-2 border-amber-600/40 rounded-3xl p-4 sm:p-5 backdrop-blur-xl mb-6 shadow-2xl shadow-black/80">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/25 shrink-0">
            <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center border border-amber-400/40">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                Balairung Sultan (Admin Dashboard)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SULTAN
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-amber-100 tracking-tight">
              Sayembara Candi Nusantara
            </h1>
          </div>
        </div>

        {/* 6-Digit Room Code Banner */}
        <div className="flex items-center gap-3 bg-stone-950 border border-amber-700/60 px-4 py-2.5 rounded-2xl w-full md:w-auto justify-between md:justify-start">
          <div className="text-left">
            <div className="text-[10px] text-amber-300/70 uppercase tracking-widest font-bold">
              Kode Room (30 Empu)
            </div>
            <div className="text-2xl font-mono font-black tracking-widest text-amber-300">
              {state.roomCode}
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 hover:text-white transition-all cursor-pointer border border-amber-900/60"
            title="Salin Kode Room"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="text-xs font-bold text-amber-300/80 hover:text-rose-400 px-3.5 py-2 rounded-xl bg-stone-800/60 hover:bg-stone-800 transition-all cursor-pointer border border-amber-900/40"
        >
          Keluar Tahta
        </button>
      </header>

      {/* Main Grid: Sultan Deck + 30-Empu Live Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Sultan Control Deck */}
        <div className="lg:col-span-1 space-y-5">
          {/* Match Timer Card */}
          <div className="bg-stone-900/80 border border-amber-700/40 rounded-3xl p-5 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-300/80">
                Waktu Sayembara (3 Menit)
              </span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-black ${
                  state.status === "PLAYING"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : state.status === "PAUSED"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : state.status === "FINISHED"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                }`}
              >
                {state.status === "PLAYING"
                  ? "SEDANG TANDING"
                  : state.status === "PAUSED"
                  ? "DIJEDA"
                  : state.status === "FINISHED"
                  ? "SELESAI"
                  : "LOBBY"}
              </span>
            </div>

            <div className="flex items-center justify-center py-4 bg-stone-950 rounded-2xl border border-amber-800/60">
              <Clock className="w-8 h-8 text-amber-400 mr-3 animate-pulse" />
              <span className="text-4xl sm:text-5xl font-mono font-black text-amber-100 tracking-wider">
                {formatTimer(state.timeRemaining)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-stone-950 rounded-2xl border border-amber-900/50">
                <div className="text-[11px] text-amber-300/70">Empu Bergabung</div>
                <div className="text-lg font-black text-amber-300">
                  {totalPlayers} <span className="text-xs font-normal text-amber-400/50">/ 30</span>
                </div>
              </div>
              <div className="p-3 bg-stone-950 rounded-2xl border border-amber-900/50">
                <div className="text-[11px] text-amber-300/70">Candi Berdiri</div>
                <div className="text-lg font-black text-emerald-400">
                  {alivePlayers} <span className="text-xs font-normal text-amber-400/50">/ {totalPlayers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sultan Royal Actions */}
          <div className="bg-stone-900/80 border border-amber-700/40 rounded-3xl p-5 backdrop-blur-xl space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Titah Sultan (Admin Controls)</span>
            </h2>

            {state.status === "LOBBY" && (
              <button
                type="button"
                onClick={onStart}
                disabled={totalPlayers === 0}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-stone-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-stone-950 text-stone-950" />
                <span>Mulai Sayembara Nusantara</span>
              </button>
            )}

            {(state.status === "PLAYING" || state.status === "PAUSED") && (
              <div className="grid grid-cols-2 gap-3">
                {state.isPaused ? (
                  <button
                    type="button"
                    onClick={onResume}
                    className="py-3 px-3 rounded-2xl font-black text-xs text-stone-950 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-stone-950" />
                    <span>Lanjutkan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPause}
                    className="py-3 px-3 rounded-2xl font-black text-xs text-stone-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-400/20"
                  >
                    <Pause className="w-3.5 h-3.5 fill-stone-950" />
                    <span>Jeda Sayembara</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onResetGame}
                  className="py-3 px-3 rounded-2xl font-black text-xs text-white bg-rose-700 hover:bg-rose-600 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Sayembara</span>
                </button>
              </div>
            )}

            {state.status === "FINISHED" && (
              <button
                type="button"
                onClick={onResetGame}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-stone-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-xl shadow-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-stone-950" />
                <span>Buka Babak Baru</span>
              </button>
            )}

            {/* Score Multiplier Upeti */}
            <div className="pt-2 border-t border-amber-900/50">
              <label className="block text-xs font-bold text-amber-300/80 mb-2">
                Multiplier Upeti Skor:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1.0, 1.5, 2.0, 3.0].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSetMultiplier(m)}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      state.scoreMultiplier === m
                        ? "bg-amber-400 text-stone-950 shadow-md shadow-amber-400/30"
                        : "bg-stone-950 text-amber-200 hover:bg-stone-800 border border-amber-900/40"
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live 30 Empu Arena Grid */}
        <div className="lg:col-span-2 bg-stone-900/80 border border-amber-700/40 rounded-3xl p-5 backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-black text-amber-100">
                Papan Empu Pembangun ({totalPlayers}/30)
              </h2>
            </div>
            <div className="text-xs text-amber-300/70 flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Balok Candi: {state.totalBlocksPlaced}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[580px] pr-1 space-y-2.5">
            {playersList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-amber-400/40">
                <Users className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada empu yang bergabung</p>
                <p className="text-xs text-amber-400/60 mt-1">
                  Bagikan kode sayembara <span className="font-mono text-amber-300">{state.roomCode}</span>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {playersList.map((player, index) => {
                  const rank = index + 1;
                  const isFrozen = player.isFrozen;

                  return (
                    <div
                      key={player.sessionId}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                        !player.isAlive
                          ? "bg-stone-950/40 border-stone-900 opacity-60"
                          : isFrozen
                          ? "bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/30"
                          : rank === 1
                          ? "bg-gradient-to-r from-amber-500/20 to-stone-950 border-amber-400/50"
                          : "bg-stone-950/70 border-amber-900/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-lg font-mono text-xs font-black flex items-center justify-center ${
                              rank === 1
                                ? "bg-amber-400 text-stone-950"
                                : rank === 2
                                ? "bg-stone-300 text-stone-950"
                                : rank === 3
                                ? "bg-amber-700 text-white"
                                : "bg-stone-800 text-amber-200"
                            }`}
                          >
                            #{rank}
                          </span>
                          <div>
                            <div className="font-black text-sm text-amber-100 flex items-center gap-1.5">
                              <span>{player.nickname}</span>
                              {isFrozen && (
                                <Snowflake className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
                              )}
                            </div>
                            <div className="text-[11px] text-amber-300/70">
                              Tinggi Candi: <span className="text-amber-300 font-bold">{player.towerHeight} Tingkat</span>
                              {player.combo > 0 && player.isAlive && (
                                <span className="text-amber-400 ml-1.5 font-bold">
                                  🔥 {player.combo}x
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-emerald-400 font-mono">
                            {player.score.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-amber-400/50 uppercase">UPETI</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-amber-900/40">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {!player.isAlive ? (
                            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                              CANDI RUNTUH
                            </span>
                          ) : isFrozen ? (
                            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                              ARCA BEKU (5s)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                              AKTIF
                            </span>
                          )}
                        </div>

                        {player.isAlive && (
                          <button
                            type="button"
                            onClick={() => onFreezePlayer(player.sessionId)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                              isFrozen
                                ? "bg-cyan-400 text-stone-950 hover:bg-cyan-300"
                                : "bg-stone-800 hover:bg-cyan-950 text-cyan-300 border border-cyan-800/60"
                            }`}
                            title="Bekukan / Lepas Kutukan Pemain"
                          >
                            <Snowflake className="w-3 h-3" />
                            <span>{isFrozen ? "Lepas Kutukan" : "Kutuk Beku"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
