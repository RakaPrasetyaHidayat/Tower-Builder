import React, { useState, useEffect } from "react";
import type { GameStateData, PlayerData, DbSavedPayload } from "../types/game";
import { getApiBaseUrl } from "../services/colyseus";
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
  Bot,
  Gamepad2,
  Database,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface AdminDashboardProps {
  state: GameStateData;
  dbSavedInfo?: DbSavedPayload | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetMultiplier: (multiplier: number) => void;
  onFreezePlayer: (targetSessionId: string) => void;
  onResetGame: () => void;
  onForceFinish?: () => void;
  onAddBots?: () => void;
  onSwitchToPlay?: () => void;
  onLeave: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  dbSavedInfo,
  onStart,
  onPause,
  onResume,
  onSetMultiplier,
  onFreezePlayer,
  onResetGame,
  onForceFinish,
  onAddBots,
  onSwitchToPlay,
  onLeave,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
  const [dbDetails, setDbDetails] = useState<{ users: number; matches: number } | null>(null);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/db/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "connected") {
          setDbStatus("connected");
          setDbDetails({ users: data.users ?? 0, matches: data.matches ?? 0 });
        } else {
          setDbStatus("error");
        }
      })
      .catch(() => setDbStatus("error"));
  }, []);

  const copyCode = () => {
    if (!state.roomCode) return;
    navigator.clipboard.writeText(state.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    if (!state.roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // List all players
  const playersList: PlayerData[] = Object.values(state.players || {});
  playersList.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  const totalPlayers = playersList.length;
  const alivePlayers = playersList.filter((p) => p.isAlive).length;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const roomDigits = (state.roomCode || "------").split("");

  return (
    <div className="min-h-screen bg-sky-kingdom text-slate-800 p-3 sm:p-6 flex flex-col max-w-7xl mx-auto select-none">
      {/* Balairung Keraton Header */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 kingdom-card rounded-3xl p-4 sm:p-5 mb-5 shadow-xl">
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow-xl shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-amber-50 rounded-[14px] flex items-center justify-center border border-amber-300">
              <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-800">
                Balairung Sultan (Admin Panel)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                GAME MASTER
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              Sayembara Candi Nusantara
            </h1>
          </div>
        </div>

        {/* Database & Room Code Banner */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Neon DB Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs shadow-sm">
            <Database className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] text-slate-600">Neon DB:</span>
            {dbStatus === "connected" ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                Terhubung ({dbDetails?.matches ?? 0} Match)
              </span>
            ) : dbStatus === "checking" ? (
              <span className="text-amber-600 animate-pulse">Memeriksa...</span>
            ) : (
              <span className="text-rose-500">Offline</span>
            )}
          </div>

          {/* 6-Digit Room Code Box */}
          <div className="flex items-center gap-2 bg-white border-2 border-blue-400 px-3 py-1.5 rounded-xl shadow-sm">
            <div className="text-left">
              <div className="text-[9px] text-slate-500 uppercase font-black">KODE SAYEMBARA</div>
              <div className="text-base sm:text-lg font-mono font-black text-blue-700">
                {state.roomCode || "MEMBUAT..."}
              </div>
            </div>

            <button
              type="button"
              onClick={copyCode}
              className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 transition-all cursor-pointer"
              title="Salin Kode 6-Digit"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Play as Sultan Quick Switch Button */}
          {onSwitchToPlay && (
            <button
              type="button"
              onClick={onSwitchToPlay}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
            >
              <Gamepad2 className="w-4 h-4 text-white" />
              <span>Mainkan Game (Arena)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="text-xs font-bold text-slate-600 hover:text-rose-600 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 transition-all cursor-pointer border border-slate-200 shrink-0"
          >
            Keluar Tahta
          </button>
        </div>
      </header>

      {/* Database Saved Notification Banner */}
      {dbSavedInfo && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-black text-emerald-900">Data Berhasil Disimpan ke Neon PostgreSQL!</span>
              <span className="ml-2 text-emerald-700">
                Match #{dbSavedInfo.roomCode} • {dbSavedInfo.participantCount} Peserta • Pemenang: {dbSavedInfo.winner || "-"}
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] text-emerald-700">ID: {dbSavedInfo.matchId.slice(-8)}</span>
        </div>
      )}

      {/* Main Grid: Sultan Control Deck + 30-Empu Live Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Sultan Control Deck */}
        <div className="lg:col-span-1 space-y-5">
          {/* Match Timer Card */}
          <div className="kingdom-card rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                Waktu Sayembara (3 Menit)
              </span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-black ${
                  state.status === "PLAYING"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : state.status === "PAUSED"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : state.status === "FINISHED"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
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

            <div className="flex items-center justify-center py-4 bg-amber-50 rounded-2xl border-2 border-amber-200">
              <Clock className="w-8 h-8 text-amber-500 mr-3 animate-pulse" />
              <span className="text-4xl sm:text-5xl font-mono font-black text-amber-900 tracking-wider">
                {formatTimer(state.timeRemaining)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[11px] text-slate-500">Empu Bergabung</div>
                <div className="text-lg font-black text-slate-800">
                  {totalPlayers} <span className="text-xs font-normal text-slate-400">/ 30</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[11px] text-slate-500">Candi Berdiri</div>
                <div className="text-lg font-black text-emerald-700">
                  {alivePlayers} <span className="text-xs font-normal text-slate-400">/ {totalPlayers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sultan Royal Actions */}
          <div className="kingdom-card rounded-3xl p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>Titah Sultan (Admin Controls)</span>
            </h2>

            {/* Start Button: ALWAYS accessible in LOBBY */}
            {state.status === "LOBBY" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onStart}
                  className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-stone-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-stone-950 text-stone-950" />
                  <span>Mulai Sayembara Nusantara</span>
                </button>
                {totalPlayers <= 1 && (
                  <p className="text-[11px] text-amber-300/70 text-center">
                    💡 Anda bisa mulai uji coba sendiri atau tekan tombol Tambah Bot di bawah!
                  </p>
                )}
              </div>
            )}

            {/* Simulation Bot Button */}
            {onAddBots && state.status !== "FINISHED" && (
              <button
                type="button"
                onClick={onAddBots}
                className="w-full py-2.5 px-3 rounded-2xl font-bold text-xs text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Bot className="w-4 h-4 text-amber-700" />
                <span>Tambah 5 Empu AI (Simulasi Bot)</span>
              </button>
            )}

            {(state.status === "PLAYING" || state.status === "PAUSED") && (
              <div className="space-y-2.5">
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
                    <span>Reset</span>
                  </button>
                </div>

                {/* Instant Force Finish & Save to Neon DB button */}
                {onForceFinish && (
                  <button
                    type="button"
                    onClick={onForceFinish}
                    className="w-full py-2.5 px-3 rounded-2xl font-black text-xs text-stone-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Selesaikan Babak & Simpan ke Neon DB</span>
                  </button>
                )}
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
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-600 mb-2">
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
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>

            {/* Switch to Arena Play View */}
            {onSwitchToPlay && (
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onSwitchToPlay}
                  className="w-full py-3 px-3 rounded-2xl font-black text-xs text-amber-900 bg-amber-50 border-2 border-amber-400 hover:bg-amber-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4 text-amber-700" />
                  <span>👑 Masuk Arena Sebagai Sultan (Mainkan Game)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live 30 Empu Arena Grid */}
        <div className="lg:col-span-2 kingdom-card rounded-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-slate-900">
                Papan Empu Pembangun ({totalPlayers}/30)
              </h2>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5 text-amber-600" />
              <span>Total Balok Candi: {state.totalBlocksPlaced}</span>
            </div>
          </div>

          {/* Big Golden Sayembara Key Card for Sultan */}
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-md">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-amber-700 uppercase font-black tracking-widest flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-amber-600" />
                  <span>KUNCI MASUK SAYEMBARA (BAGIKAN KE PEMAIN)</span>
                </div>
                <div className="text-xs text-amber-800/70 mt-0.5">
                  Pemain memasukkan 6 digit ini di menu "Gabung (Empu)" untuk masuk:
                </div>
              </div>

              {/* 6 Digit Golden Letter Boxes */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {roomDigits.map((char, i) => (
                  <div
                    key={i}
                    className="w-8 h-10 sm:w-10 sm:h-12 rounded-xl bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 text-white font-mono font-black text-lg sm:text-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-300 transform hover:scale-105 transition-transform"
                  >
                    {char}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-amber-200">
              <button
                type="button"
                onClick={copyCode}
                className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "Kode Tersalin!" : "Salin Kode 6 Digit"}</span>
              </button>

              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Link Tersalin!" : "Salin Link Undangan"}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-2.5">
            {playersList.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <Users className="w-10 h-10 mb-2 text-amber-300 opacity-50 animate-pulse" />
                <p className="text-sm font-bold text-slate-700">Menunggu Empu Bergabung...</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Tekan "Tambah 5 Empu AI" di menu kiri untuk menguji multiplayer secara instan!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {playersList.map((player, index) => {
                  const rank = index + 1;
                  const isFrozen = player.isFrozen;
                  const isGM = player.role === "GAME_MASTER";

                  return (
                    <div
                      key={player.sessionId}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                        !player.isAlive
                          ? "bg-slate-100 border-slate-200 opacity-60"
                          : isFrozen
                          ? "bg-cyan-50 border-cyan-300 shadow-md shadow-cyan-100"
                          : isGM
                          ? "bg-gradient-to-r from-amber-100 to-amber-50 border-amber-400"
                          : rank === 1
                          ? "bg-gradient-to-r from-amber-50 to-white border-amber-300"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-lg font-mono text-xs font-black flex items-center justify-center ${
                              isGM
                                ? "bg-amber-500 text-white font-black"
                                : rank === 1
                                ? "bg-amber-400 text-white"
                                : rank === 2
                                ? "bg-slate-400 text-white"
                                : rank === 3
                                ? "bg-amber-700 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {isGM ? "👑" : `#${rank}`}
                          </span>
                          <div>
                            <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                              <span>{player.nickname}</span>
                              {isGM && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 border border-amber-300">
                                  SULTAN
                                </span>
                              )}
                              {isFrozen && (
                                <Snowflake className="w-3.5 h-3.5 text-cyan-500 animate-spin" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Tinggi Candi: <span className="text-amber-700 font-bold">{player.towerHeight} Tingkat</span>
                              {player.combo > 0 && player.isAlive && (
                                <span className="text-orange-600 ml-1.5 font-bold flex-inline items-center">
                                  <Flame className="w-3 h-3 text-orange-500 inline" /> {player.combo}x
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-emerald-700 font-mono">
                            {player.score.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase">UPETI</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {!player.isAlive ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              CANDI RUNTUH
                            </span>
                          ) : isFrozen ? (
                            <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold">
                              ARCA BEKU (5s)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              AKTIF
                            </span>
                          )}
                        </div>

                        {!isGM && player.isAlive && (
                          <button
                            type="button"
                            onClick={() => onFreezePlayer(player.sessionId)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                              isFrozen
                                ? "bg-cyan-500 text-white hover:bg-cyan-400"
                                : "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-300"
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
