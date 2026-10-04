import React, { useState } from "react";
import {
  Crown,
  Landmark,
  Users,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Shield,
  Hammer,
  Trophy,
  X,
} from "lucide-react";
import { getApiBaseUrl } from "../services/colyseus";

interface LobbyProps {
  onJoin: (roomCode: string, nickname: string) => Promise<void>;
  onCreate: (nickname: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const Lobby: React.FC<LobbyProps> = ({
  onJoin,
  onCreate,
  isLoading,
  error,
}) => {
  const [tab, setTab] = useState<"join" | "create">("create");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get("room") || params.get("code");
      if (codeFromUrl && codeFromUrl.trim().length === 6) {
        return codeFromUrl.trim().toUpperCase();
      }
    }
    return "";
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // Global Neon DB Leaderboard Modal
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalRecords, setGlobalRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const openGlobalLeaderboard = () => {
    setShowGlobalModal(true);
    setLoadingRecords(true);
    fetch(`${getApiBaseUrl()}/api/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        setGlobalRecords(data.leaderboard || []);
        setLoadingRecords(false);
      })
      .catch(() => setLoadingRecords(false));
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!nickname.trim()) {
      setLocalError("Masukkan nama Empu / Pemain Anda");
      return;
    }
    if (roomCode.trim().length !== 6) {
      setLocalError("Kode room harus 6 karakter (contoh: K9X2P4)");
      return;
    }
    await onJoin(roomCode.trim().toUpperCase(), nickname.trim());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!nickname.trim()) {
      setLocalError("Masukkan gelar / nama Sultan (Game Master)");
      return;
    }
    await onCreate(nickname.trim());
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-sky-kingdom text-slate-800 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Soft Sky & Kingdom Ambient Atmosphere */}
      <div className="absolute top-10 -left-20 w-96 h-96 bg-sky-300/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/50 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-64 h-64 bg-teal-200/30 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header Indonesian Heritage Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-500 p-[3px] shadow-xl shadow-amber-500/20 mb-3">
            <div className="w-full h-full bg-amber-50 rounded-[13px] flex items-center justify-center border border-amber-300">
              <Landmark className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 drop-shadow-sm">
            CANDI NUSANTARA
          </h1>
          <p className="text-xs font-bold tracking-widest text-amber-700 uppercase mt-1">
            Game Tumpuk Warisan Budaya • 30 Pemain + 1 Sultan
          </p>

        </div>

        {/* Card Frame with Clean Royal Parchment Aesthetic */}
        <div className="kingdom-card rounded-3xl p-6 relative">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setTab("create");
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tab === "create"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Buat Room (Sultan)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("join");
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tab === "join"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>Gabung (Empu)</span>
            </button>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{displayError}</span>
            </div>
          )}

          {tab === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Gelar / Nama Sultan (Game Master)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Contoh: Sultan Hayam Wuruk / Raka"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5">
                <Shield className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-black text-amber-900">Tahta Sultan & Arena Pembangun</div>
                  <div className="text-[11px] text-amber-800/90 mt-0.5">
                    Sultan dapat ikut bermain, mengatur multiplier upeti, dan melihat hasil pertandingan.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm text-white bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:brightness-105 active:scale-[0.98] shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-white" />
                    <span>Buka Sayembara Kerajaan</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Empu / Pembangun
                </label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="Contoh: Empu Gandring / Raka"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kode Sayembara Room (6 Digit)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Contoh: K9X2P4"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-center font-mono tracking-widest text-blue-700 uppercase text-lg font-black placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:brightness-105 active:scale-[0.98] shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Ikuti Sayembara Candi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Kapasitas hingga 30 Empu dalam 1 arena pertandingan</span>
              </div>
            </form>
          )}

          {/* View Database Records Button */}
          <div className="mt-4 pt-3 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={openGlobalLeaderboard}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Lihat Rekor Tertinggi (Neon Database)</span>
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-600 font-medium mt-6 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Pesona Budaya Candi & Keraton Nusantara</span>
        </div>
      </div>

      {/* Global Neon DB Leaderboard Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border-2 border-amber-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-slate-800 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  Rekor Juara Candi (Neon PostgreSQL)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGlobalModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {loadingRecords ? (
                <div className="py-12 text-center text-xs text-amber-700 animate-pulse">
                  Mengambil data rekor dari Neon PostgreSQL...
                </div>
              ) : globalRecords.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Belum ada catatan pertandingan tersimpan di database.
                </div>
              ) : (
                globalRecords.map((item) => (
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

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowGlobalModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Tutup Papan Rekor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
