import React, { useState, useEffect } from "react";
import type { PlayerData, DbSavedPayload } from "../types/game";
import { getApiBaseUrl } from "../services/colyseus";
import { Trophy, Award, Crown, RotateCcw, Database, CheckCircle2, History } from "lucide-react";

interface LeaderboardSidebarProps {
  players: PlayerData[];
  currentSessionId: string;
}

export const LeaderboardSidebar: React.FC<LeaderboardSidebarProps> = ({
  players,
  currentSessionId,
}) => {
  const sorted = [...players];
  sorted.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  return (
    <aside className="kingdom-card rounded-3xl p-4 shadow-xl select-none w-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-200">
        <Trophy className="w-4 h-4 text-amber-600" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
          Papan Klasemen Empu
        </h3>
        <span className="ml-auto text-[10px] font-mono font-bold text-slate-500">
          {sorted.length}/30
        </span>
      </div>

      <div className="space-y-1.5 overflow-y-auto max-h-[300px] sm:max-h-[460px] pr-1">
        {sorted.map((player, idx) => {
          const rank = idx + 1;
          const isMe = player.sessionId === currentSessionId;
          const isGM = player.role === "GAME_MASTER";

          return (
            <div
              key={player.sessionId}
              className={`flex items-center justify-between p-2.5 rounded-2xl text-xs transition-all ${
                isMe
                  ? "bg-amber-100 border border-amber-300 text-amber-950 font-bold shadow-sm"
                  : !player.isAlive
                  ? "bg-slate-100 text-slate-400 border border-transparent"
                  : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono font-black text-[10px] ${
                    isGM
                      ? "bg-amber-500 text-white"
                      : rank === 1
                      ? "bg-amber-500 text-white"
                      : rank === 2
                      ? "bg-slate-300 text-slate-800"
                      : rank === 3
                      ? "bg-amber-700 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isGM ? "👑" : rank}
                </span>
                <span className="font-bold truncate max-w-[100px]">
                  {player.nickname} {isMe && "(Anda)"}
                </span>
              </div>

              <div className="font-mono font-black text-emerald-600">
                {player.score.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

interface MatchSummaryModalProps {
  players: PlayerData[];
  winnerSessionId?: string;
  roomCode: string;
  currentSessionId: string;
  isGameMaster: boolean;
  dbSavedInfo?: DbSavedPayload | null;
  onRestart?: () => void;
  onClose: () => void;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  players,
  roomCode,
  currentSessionId,
  isGameMaster,
  dbSavedInfo,
  onRestart,
  onClose,
}) => {
  const [tab, setTab] = useState<"match" | "global">("match");
  const [globalLeaderboard, setGlobalLeaderboard] = useState<any[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);

  const sorted = [...players];
  sorted.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  const winner = sorted[0];
  const myPlayer = sorted.find((p) => p.sessionId === currentSessionId);
  const myRank = sorted.findIndex((p) => p.sessionId === currentSessionId) + 1;

  useEffect(() => {
    if (tab === "global") {
      setIsLoadingGlobal(true);
      fetch(`${getApiBaseUrl()}/api/leaderboard`)
        .then((res) => res.json())
        .then((data) => {
          setGlobalLeaderboard(data.leaderboard || []);
          setIsLoadingGlobal(false);
        })
        .catch(() => setIsLoadingGlobal(false));
    }
  }, [tab]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
      <div className="bg-white border-2 border-amber-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl text-slate-800 flex flex-col items-center relative overflow-hidden">
        {/* Tab switch: Match results vs Neon DB all-time leaderboard */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 w-full border border-slate-200 relative z-10">
          <button
            type="button"
            onClick={() => setTab("match")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "match"
                ? "bg-amber-500 text-white font-black shadow-md shadow-amber-500/30"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Hasil Babak Ini</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("global")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "global"
                ? "bg-amber-500 text-white font-black shadow-md shadow-amber-500/30"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Rekor Neon PostgreSQL</span>
          </button>
        </div>

        {tab === "match" ? (
          <>
            {/* Podium Crown Banner */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-500 p-0.5 shadow-xl shadow-amber-500/20 mb-2 relative z-10">
              <div className="w-full h-full bg-amber-50 rounded-[14px] flex items-center justify-center border border-amber-300">
                <Crown className="w-8 h-8 text-amber-600 animate-bounce" />
              </div>
            </div>

            <div className="text-xs font-mono uppercase tracking-widest text-amber-700 font-bold mb-0.5 relative z-10">
              HASIL SAYEMBARA • ROOM #{roomCode}
            </div>
            <h2 className="text-2xl font-black text-slate-900 text-center relative z-10">
              Juara Utama: {winner?.nickname || "Tidak Ada"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-5 relative z-10">
              Perolehan Upeti Tertinggi: <span className="text-emerald-600 font-black font-mono">{winner?.score || 0} Poin</span>
            </p>

            {/* Top 3 Nusantara Royal Podium */}
            <div className="grid grid-cols-3 gap-2.5 w-full mb-5 relative z-10">
              {/* 2nd Place */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col justify-end">
                <div className="w-6 h-6 mx-auto rounded-full bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center mb-1">
                  2
                </div>
                <div className="text-xs font-bold truncate text-slate-800">
                  {sorted[1]?.nickname || "-"}
                </div>
                <div className="text-[11px] font-mono text-emerald-600 font-bold">
                  {sorted[1]?.score || 0}
                </div>
              </div>

              {/* 1st Place */}
              <div className="p-3 bg-gradient-to-b from-amber-100 to-amber-50 border-2 border-amber-300 rounded-2xl text-center relative -top-2 shadow-md">
                <Award className="w-6 h-6 mx-auto text-amber-600 mb-0.5" />
                <div className="text-xs font-black truncate text-amber-900">
                  {winner?.nickname || "-"}
                </div>
                <div className="text-xs font-mono text-emerald-600 font-black">
                  {winner?.score || 0}
                </div>
              </div>

              {/* 3rd Place */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col justify-end">
                <div className="w-6 h-6 mx-auto rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center mb-1">
                  3
                </div>
                <div className="text-xs font-bold truncate text-slate-800">
                  {sorted[2]?.nickname || "-"}
                </div>
                <div className="text-[11px] font-mono text-emerald-600 font-bold">
                  {sorted[2]?.score || 0}
                </div>
              </div>
            </div>

            {/* User Stats */}
            {myPlayer && (
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-4 text-xs flex items-center justify-between relative z-10">
                <div>
                  <span className="text-slate-500">Peringkat:</span>
                  <span className="ml-1 font-black text-amber-700">#{myRank}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tinggi:</span>
                  <span className="ml-1 font-mono font-black text-slate-800">{myPlayer.towerHeight} Balok</span>
                </div>
                <div>
                  <span className="text-slate-500">Upeti:</span>
                  <span className="ml-1 font-mono font-black text-emerald-600">{myPlayer.score}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full space-y-3 mb-4 max-h-[340px] overflow-y-auto pr-1 relative z-10">
            <div className="text-xs text-slate-600 font-bold flex items-center gap-1.5 pb-2 border-b border-slate-200">
              <History className="w-4 h-4 text-amber-600" />
              <span>Klasemen Rekor Seluruh Sayembara (Database Neon)</span>
            </div>

            {isLoadingGlobal ? (
              <div className="py-12 text-center text-xs text-amber-700 animate-pulse">
                Memuat data dari Neon PostgreSQL...
              </div>
            ) : globalLeaderboard.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Belum ada rekor tersimpan di database. Selesaikan babak untuk mencatat rekor!
              </div>
            ) : (
              globalLeaderboard.map((item) => (
                <div
                  key={`${item.nickname}_${item.rank}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-100 font-mono font-black text-[10px] flex items-center justify-center text-amber-800">
                      {item.rank}
                    </span>
                    <div>
                      <div className="font-black text-slate-900">{item.nickname}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.towerHeight} Balok • #{item.roomCode || "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-black text-emerald-600">
                    {item.score.toLocaleString()} Poin
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Database Save Confirmation Pill */}
        <div className="w-full mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Tersimpan di Neon PostgreSQL</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-700">
            {dbSavedInfo ? `ID: ${dbSavedInfo.matchId.slice(-6)}` : "Otomatis Disimpan"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex gap-3 relative z-10">
          {isGameMaster && onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 py-3 px-4 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span>Buka Babak Baru</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer border border-slate-300"
          >
            Tutup Papan
          </button>
        </div>
      </div>
    </div>
  );
};
