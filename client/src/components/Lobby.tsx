import React, { useState } from "react";
import { Crown, Landmark, Users, ArrowRight, Sparkles, AlertCircle, Shield, Hammer } from "lucide-react";

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
  const [tab, setTab] = useState<"join" | "create">("join");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-stone-950 text-amber-50 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Warm Nusantara Sunset Ambient Lights */}
      <div className="absolute top-1/4 -left-20 w-88 h-88 bg-amber-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-88 h-88 bg-orange-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-60 h-60 bg-emerald-700/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header Indonesian Heritage Badge */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-600 p-[2.5px] shadow-2xl shadow-amber-600/30 mb-3.5">
            <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center border border-amber-500/40">
              <Landmark className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-amber-100 via-amber-300 to-orange-400 bg-clip-text text-transparent">
            CANDI NUSANTARA
          </h1>
          <p className="text-xs font-bold tracking-widest text-amber-400/90 uppercase mt-1">
            Game Tumpuk Warisan Budaya • 30 Pemain + 1 Sultan
          </p>
        </div>

        {/* Card Frame with Carved Wood/Stone Aesthetic */}
        <div className="bg-stone-900/90 border border-amber-600/40 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl shadow-black/80 relative">
          {/* Decorative Corner Ornaments */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-500/60 rounded-tl-sm" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-500/60 rounded-tr-sm" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-500/60 rounded-bl-sm" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-500/60 rounded-br-sm" />

          {/* Role Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-stone-950/80 rounded-2xl mb-6 border border-amber-900/50">
            <button
              type="button"
              onClick={() => {
                setTab("join");
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tab === "join"
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 shadow-md shadow-amber-500/30"
                  : "text-amber-200/70 hover:text-white"
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>Gabung (Empu)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("create");
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tab === "create"
                  ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-stone-950 shadow-md shadow-amber-400/30"
                  : "text-amber-200/70 hover:text-white"
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Buat Room (Sultan)</span>
            </button>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{displayError}</span>
            </div>
          )}

          {tab === "join" ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1.5">
                  Nama Empu / Pembangun
                </label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="Contoh: Empu Gandring / Raka"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-amber-800/60 text-sm text-amber-100 placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1.5">
                  Kode Sayembara Room (6 Digit)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Contoh: K9X2P4"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-amber-800/60 text-center font-mono tracking-widest text-amber-300 uppercase text-lg font-black placeholder-stone-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-black text-sm text-stone-950 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-[0.98] shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Ikuti Sayembara Candi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-300/70 pt-2">
                <Users className="w-3.5 h-3.5" />
                <span>Kapasitas hingga 30 Empu dalam 1 arena pertandingan</span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1.5">
                  Gelar / Nama Sultan (Game Master)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Contoh: Sultan Hayam Wuruk"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-amber-800/60 text-sm text-amber-100 placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex gap-2.5">
                <Shield className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-black text-amber-300">Tahta Sultan (Game Master)</div>
                  <div className="text-[11px] text-amber-200/80 mt-0.5">
                    Membuat room 6-digit, memimpin jalannya sayembara 3 menit, mengatur multiplier upeti, dan membekukan pemain nakal.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-black text-sm text-stone-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 active:scale-[0.98] shadow-lg shadow-amber-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-stone-950" />
                    <span>Buka Sayembara Kerajaan</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-[11px] text-amber-400/60 mt-6 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Pesona Budaya Candi & Keraton Nusantara</span>
        </div>
      </div>
    </div>
  );
};
