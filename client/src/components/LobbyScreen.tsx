import React, { useState } from "react";
import { Crown, Gamepad2, Users, ArrowRight, Sparkles, AlertCircle } from "lucide-react";

interface LobbyScreenProps {
  onJoin: (roomCode: string, nickname: string) => Promise<void>;
  onCreate: (nickname: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onJoin,
  onCreate,
  isLoading,
  error,
}) => {
  const [tab, setTab] = useState<"join" | "create">("join");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!nickname.trim()) {
      setLocalError("Masukkan nama panggilan Anda");
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
      setLocalError("Masukkan nama Game Master Anda");
      return;
    }
    await onCreate(nickname.trim());
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Dynamic ambient gradients */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-sky-500/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-sky-400 to-emerald-400 p-[2px] shadow-lg shadow-indigo-500/30 mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-sky-300 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-sky-100 to-indigo-300 bg-clip-text text-transparent">
            TOWER BUILDER
          </h1>
          <p className="text-xs font-semibold tracking-wider text-indigo-400 uppercase mt-1">
            Multiplayer Battle • 30 Players + 1 GM
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl shadow-indigo-950/50">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/70 rounded-xl mb-6 border border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                setTab("join");
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                tab === "join"
                  ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Join Player</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("create");
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                tab === "create"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Crown className="w-4 h-4 text-amber-200" />
              <span>Host (GM)</span>
            </button>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Join Form */}
          {tab === "join" ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Pemain
                </label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="Contoh: Alex"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kode Room (6 Digit)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Contoh: K9X2P4"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-center font-mono tracking-widest text-sky-300 uppercase placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-lg font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk ke Pertandingan</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-2">
                <Users className="w-3.5 h-3.5" />
                <span>Kapasitas hingga 30 pemain per match</span>
              </div>
            </form>
          ) : (
            /* Create / GM Form */
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Game Master
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Contoh: GM_Leader"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200/90 text-xs flex gap-2">
                <Crown className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">Hak Akses Game Master</div>
                  <div className="text-[11px] text-amber-200/80 mt-0.5">
                    Membuat room 6-digit, mengontrol timer (3 menit), mengaktifkan multiplier, dan memantau leaderboard real-time.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-[0.98] shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-amber-200" />
                    <span>Buat Room Game Master</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500 mt-6">
          Powered by React + Vite + Colyseus + Prisma
        </div>
      </div>
    </div>
  );
};
