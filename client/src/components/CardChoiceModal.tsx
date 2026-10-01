import React, { useState, useEffect } from "react";
import type { CardOption, CardType, PlayerData } from "../types/game";
import { Sparkles, Snowflake, Coins, Hammer, Users, Clock, Flame } from "lucide-react";

interface CardChoiceModalProps {
  options: CardOption[];
  players: PlayerData[];
  currentSessionId: string;
  onSelect: (cardType: CardType, targetSessionId?: string) => void;
  onClose: () => void;
}

export const CardChoiceModal: React.FC<CardChoiceModalProps> = ({
  options,
  players,
  currentSessionId,
  onSelect,
  onClose,
}) => {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(5);

  const opponents = players.filter(
    (p) => p.sessionId !== currentSessionId && p.role === "PLAYER" && p.isAlive
  );

  // 5-second auto countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const handleCardClick = (card: CardOption) => {
    if (card.category === "BUFF") {
      onSelect(card.type);
      onClose();
    } else {
      setSelectedCard(card.type);
      if (opponents.length > 0 && !targetId) {
        setTargetId(opponents[0].sessionId);
      }
    }
  };

  const handleConfirmSabotage = () => {
    if (selectedCard && targetId) {
      onSelect(selectedCard, targetId);
      onClose();
    }
  };

  const getIndonesianCardDetails = (type: CardType) => {
    switch (type) {
      case "DOUBLE_FUNDS":
        return {
          title: "Berkah Dewi Sri",
          desc: "Kemakmuran melimpah! Gandakan skor 2x selama 10 detik.",
          icon: <Coins className="w-6 h-6 text-amber-300" />,
        };
      case "AUTO_CRANE":
        return {
          title: "Tangan Sakti Empu",
          desc: "Keahlian leluhur! Balok berikutnya 100% presisi di tengah.",
          icon: <Hammer className="w-6 h-6 text-yellow-300" />,
        };
      case "LAND_DISPUTE":
        return {
          title: "Kutukan Jonggrang",
          desc: "Jadikan lawan arca batu! Membekukan target selama 5 detik.",
          icon: <Snowflake className="w-6 h-6 text-cyan-300" />,
        };
      case "CORRUPTION":
        return {
          title: "Upeti Kadipaten",
          desc: "Tarik upeti paksa! Pangkas 25% perolehan skor lawan target.",
          icon: <Flame className="w-6 h-6 text-rose-400" />,
        };
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
      <div className="bg-stone-900 border-2 border-amber-600/50 rounded-3xl p-6 max-w-lg w-full shadow-2xl shadow-black/80 text-amber-50 relative overflow-hidden">
        {/* Top 5s countdown progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-stone-950">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 5) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Pusaka 5 Balok Candi!</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-950 border border-amber-800/60 text-xs font-mono font-bold text-amber-400">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>0:0{countdown}s</span>
          </div>
        </div>

        <div className="text-center mb-5">
          <h3 className="text-xl font-black text-amber-100">Pilih Pusaka Sakti</h3>
          <p className="text-xs text-amber-200/70 mt-0.5">
            Gunakan berkah leluhur untuk diri sendiri atau lancarkan taktik ke empu lawan
          </p>
        </div>

        {/* Card Options Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {options.map((card) => {
            const isBuff = card.category === "BUFF";
            const isSelected = selectedCard === card.type;
            const details = getIndonesianCardDetails(card.type);

            return (
              <button
                key={card.type}
                type="button"
                onClick={() => handleCardClick(card)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "ring-2 ring-amber-400 bg-stone-800/90 border-transparent shadow-xl"
                    : isBuff
                    ? "bg-stone-950/70 border-amber-600/40 hover:border-amber-400 hover:bg-stone-900"
                    : "bg-stone-950/70 border-rose-600/40 hover:border-rose-400 hover:bg-stone-900"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isBuff
                          ? "bg-amber-500/20 border-amber-500/40"
                          : "bg-rose-500/20 border-rose-500/40"
                      }`}
                    >
                      {details.icon}
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        isBuff
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {isBuff ? "BERKAH" : "TAKTIK"}
                    </span>
                  </div>
                  <div className="font-black text-sm text-amber-100">{details.title}</div>
                  <div className="text-[11px] text-amber-200/70 mt-1 leading-snug">
                    {details.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Target Selection for Sabotage */}
        {selectedCard && (selectedCard === "LAND_DISPUTE" || selectedCard === "CORRUPTION") && (
          <div className="p-4 bg-stone-950/90 rounded-2xl border border-amber-800/60 mb-4 animate-fadeIn">
            <label className="block text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Pilih Empu Lawan yang Dituju:</span>
            </label>
            {opponents.length === 0 ? (
              <div className="text-xs text-amber-400/60">Belum ada lawan lain yang aktif.</div>
            ) : (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-stone-900 border border-amber-700/60 text-xs text-amber-100 focus:outline-none focus:border-amber-400"
              >
                {opponents.map((opp) => (
                  <option key={opp.sessionId} value={opp.sessionId}>
                    {opp.nickname} (Skor: {opp.score} • Tinggi: {opp.towerHeight})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleConfirmSabotage}
              disabled={!targetId}
              className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-xs font-black text-stone-950 transition-all cursor-pointer disabled:opacity-50"
            >
              Luncurkan Ajian!
            </button>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-amber-400/60 pt-1">
          <span>Otomatis lewati dalam {countdown} detik</span>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-amber-200 transition-colors cursor-pointer"
          >
            Lewati
          </button>
        </div>
      </div>
    </div>
  );
};
