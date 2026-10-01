import React from "react";
import type { PlayerData } from "../types/game";
import { Trophy, Award, Crown, RotateCcw } from "lucide-react";

interface LeaderboardSidebarProps {
  players: PlayerData[];
  currentSessionId: string;
}

export const LeaderboardSidebar: React.FC<LeaderboardSidebarProps> = ({
  players,
  currentSessionId,
}) => {
  const sorted = [...players].filter((p) => p.role === "PLAYER");
  sorted.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  return (
    <aside className="bg-stone-900/90 border border-amber-600/40 backdrop-blur-xl rounded-3xl p-4 shadow-2xl shadow-black/80 select-none w-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-amber-900/50">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-black uppercase tracking-wider text-amber-200">
          Papan Klasemen Empu
        </h3>
        <span className="ml-auto text-[10px] font-mono font-bold text-amber-400/60">
          {sorted.length}/30
        </span>
      </div>

      <div className="space-y-1.5 overflow-y-auto max-h-[300px] sm:max-h-[460px] pr-1">
        {sorted.map((player, idx) => {
          const rank = idx + 1;
          const isMe = player.sessionId === currentSessionId;

          return (
            <div
              key={player.sessionId}
              className={`flex items-center justify-between p-2.5 rounded-2xl text-xs transition-all ${
                isMe
                  ? "bg-amber-500/20 border border-amber-400/50 text-amber-100 shadow-md shadow-amber-500/10"
                  : !player.isAlive
                  ? "bg-stone-950/40 text-stone-500 border border-transparent"
                  : "bg-stone-950/70 text-amber-200/90 border border-amber-950"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono font-black text-[10px] ${
                    rank === 1
                      ? "bg-amber-400 text-stone-950"
                      : rank === 2
                      ? "bg-stone-300 text-stone-950"
                      : rank === 3
                      ? "bg-amber-700 text-white"
                      : "bg-stone-800 text-amber-300/70"
                  }`}
                >
                  {rank}
                </span>
                <span className="font-bold truncate max-w-[95px]">
                  {player.nickname} {isMe && "(Anda)"}
                </span>
              </div>

              <div className="font-mono font-black text-emerald-400">
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
  onRestart?: () => void;
  onClose: () => void;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  players,
  roomCode,
  currentSessionId,
  isGameMaster,
  onRestart,
  onClose,
}) => {
  const sorted = [...players].filter((p) => p.role === "PLAYER");
  sorted.sort((a, b) => b.score - a.score || b.towerHeight - a.towerHeight);

  const winner = sorted[0];
  const myPlayer = sorted.find((p) => p.sessionId === currentSessionId);
  const myRank = sorted.findIndex((p) => p.sessionId === currentSessionId) + 1;

  return (
    <div className="fixed inset-0 bg-stone-950/90 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
      <div className="bg-stone-900 border-2 border-amber-600/50 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl shadow-black/80 text-amber-50 flex flex-col items-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Podium Crown Banner */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/30 mb-3 relative z-10">
          <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center border border-amber-400/40">
            <Crown className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>
        </div>

        <div className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold mb-1 relative z-10">
          HASIL AKHIR SAYEMBARA • ROOM #{roomCode}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-amber-100 text-center relative z-10">
          Pemenang Utama: {winner?.nickname || "Tidak Ada"}
        </h2>
        <p className="text-xs text-amber-200/70 mt-1 mb-6 relative z-10">
          Perolehan Upeti Tertinggi: <span className="text-emerald-400 font-black font-mono">{winner?.score || 0} Poin</span>
        </p>

        {/* Top 3 Nusantara Royal Podium */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-6 relative z-10">
          {/* 2nd Place */}
          <div className="p-3 bg-stone-950 border border-amber-900/60 rounded-2xl text-center flex flex-col justify-end">
            <div className="w-7 h-7 mx-auto rounded-full bg-stone-300 text-stone-950 font-black text-xs flex items-center justify-center mb-1">
              2
            </div>
            <div className="text-xs font-bold truncate text-stone-300">
              {sorted[1]?.nickname || "-"}
            </div>
            <div className="text-[11px] font-mono text-emerald-400 font-bold">
              {sorted[1]?.score || 0}
            </div>
          </div>

          {/* 1st Place */}
          <div className="p-3.5 bg-gradient-to-b from-amber-500/25 to-stone-950 border-2 border-amber-400/60 rounded-2xl text-center relative -top-2 shadow-xl shadow-amber-500/10">
            <Award className="w-6 h-6 mx-auto text-amber-400 mb-0.5" />
            <div className="text-xs font-black truncate text-amber-200">
              {winner?.nickname || "-"}
            </div>
            <div className="text-xs font-mono text-emerald-400 font-black">
              {winner?.score || 0}
            </div>
          </div>

          {/* 3rd Place */}
          <div className="p-3 bg-stone-950 border border-amber-900/60 rounded-2xl text-center flex flex-col justify-end">
            <div className="w-7 h-7 mx-auto rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center mb-1">
              3
            </div>
            <div className="text-xs font-bold truncate text-stone-300">
              {sorted[2]?.nickname || "-"}
            </div>
            <div className="text-[11px] font-mono text-emerald-400 font-bold">
              {sorted[2]?.score || 0}
            </div>
          </div>
        </div>

        {/* User Stats (If Player) */}
        {myPlayer && (
          <div className="w-full bg-stone-950 border border-amber-800/60 rounded-2xl p-3.5 mb-5 text-xs flex items-center justify-between relative z-10">
            <div>
              <span className="text-amber-300/70">Peringkat Anda:</span>
              <span className="ml-2 font-black text-amber-300">#{myRank} dari {sorted.length} Empu</span>
            </div>
            <div>
              <span className="text-amber-300/70">Tinggi Candi:</span>
              <span className="ml-2 font-mono font-black text-amber-300">{myPlayer.towerHeight} Tingkat</span>
            </div>
            <div>
              <span className="text-amber-300/70">Upeti:</span>
              <span className="ml-2 font-mono font-black text-emerald-400">{myPlayer.score}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex gap-3 relative z-10">
          {isGameMaster && onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 py-3 px-4 rounded-2xl font-black text-xs text-stone-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <RotateCcw className="w-4 h-4 text-stone-950" />
              <span>Buka Babak Baru</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs text-amber-200 bg-stone-800 hover:bg-stone-700 active:scale-95 transition-all cursor-pointer border border-amber-900/60"
          >
            Tutup Papan
          </button>
        </div>
      </div>
    </div>
  );
};
