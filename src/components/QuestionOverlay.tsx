import React, { useState, useEffect, useRef } from "react";
import type { Question, QuestionResult } from "../types/game";
import { Brain, CheckCircle2, XCircle, Clock } from "lucide-react";

interface QuestionOverlayProps {
  question: Question | null;
  result: QuestionResult | null;
  canPlaceBlock: boolean;
  onAnswer: (questionId: number, answerIndex: number) => void;
}

export const QuestionOverlay: React.FC<QuestionOverlayProps> = ({
  question,
  result,
  canPlaceBlock,
  onAnswer,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<{
    questionId: number;
    questionNumber: number;
    index: number;
  } | null>(null);
  const [penaltyCountdown, setPenaltyCountdown] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedIdx = selectedAnswer?.questionId === question?.questionId &&
    selectedAnswer?.questionNumber === question?.questionNumber
    ? selectedAnswer?.index ?? null
    : null;

  // Hitung mundur penalti
  useEffect(() => {
    if (result && !result.correct && result.penaltyMs) {
      setPenaltyCountdown(Math.ceil(result.penaltyMs / 1000));
      countdownRef.current = setInterval(() => {
        setPenaltyCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [result]);

  const handleAnswer = (idx: number) => {
    if (selectedIdx !== null || !question) return; // sudah jawab
    setSelectedAnswer({
      questionId: question.questionId,
      questionNumber: question.questionNumber,
      index: idx,
    });
    onAnswer(question.questionId, idx);
  };

  // Jika tidak ada pertanyaan dan sudah boleh letakkan blok → tidak tampil overlay ini
  if (canPlaceBlock) return null;

  // Tampilkan hasil jawaban salah (penalti)
  if (result && !result.correct) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 bg-rose-950 border-2 border-rose-500 rounded-3xl p-6 text-center shadow-2xl shadow-rose-900/60 animate-bounce-once">
          <XCircle className="w-14 h-14 text-rose-400 mx-auto mb-3" />
          <div className="text-rose-100 font-black text-xl mb-1">Jawaban Salah!</div>
          <div className="text-rose-300 text-sm mb-4">
            Jawaban benar: <span className="font-black text-white">{question?.options[result.correctIndex]}</span>
          </div>
          <div className="flex items-center justify-center gap-2 bg-rose-900/50 rounded-2xl px-4 py-3 border border-rose-700">
            <Clock className="w-5 h-5 text-rose-300 animate-spin" style={{ animationDuration: "2s" }} />
            <span className="text-rose-200 font-black text-lg">
              Soal berikutnya dalam <span className="text-white text-2xl">{penaltyCountdown}</span>s
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Tampilkan soal
  if (!question) return null;

  const optionLabels = ["A", "B", "C", "D"];
  const optionColors = [
    "from-blue-600 to-blue-700 border-blue-400 hover:from-blue-500 hover:to-blue-600",
    "from-violet-600 to-violet-700 border-violet-400 hover:from-violet-500 hover:to-violet-600",
    "from-emerald-600 to-emerald-700 border-emerald-400 hover:from-emerald-500 hover:to-emerald-600",
    "from-orange-600 to-orange-700 border-orange-400 hover:from-orange-500 hover:to-orange-600",
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center pb-4 px-3 bg-black/65 backdrop-blur-sm">
      <div className="w-full max-w-lg">
        {/* Header soal */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="flex items-center gap-2 bg-indigo-900/80 border border-indigo-500/50 rounded-2xl px-3 py-1.5">
            <Brain className="w-4 h-4 text-indigo-300" />
            <span className="text-indigo-200 text-[11px] font-black uppercase tracking-wider">
              Soal #{question.questionNumber}
            </span>
          </div>
          <div className="bg-slate-800/80 border border-slate-600/50 rounded-2xl px-3 py-1.5">
            <span className="text-slate-300 text-[10px] font-bold">{question.category}</span>
          </div>
        </div>

        {/* Teks pertanyaan */}
        <div className="bg-slate-900/95 border-2 border-indigo-500/60 rounded-3xl p-4 mb-3 shadow-2xl shadow-indigo-900/40">
          <p className="text-white font-bold text-sm sm:text-base leading-relaxed text-center">
            {question.text}
          </p>
        </div>

        {/* Pilihan jawaban 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {question.options.map((opt, idx) => {
            const isSelected = selectedIdx === idx;
            let btnClass = `bg-gradient-to-b ${optionColors[idx]} border`;

            // Setelah memilih, tampilkan hasil (hijau = benar dari server, merah = salah)
            if (selectedIdx !== null && result) {
              if (idx === result.correctIndex) {
                btnClass = "bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-300 scale-105";
              } else if (isSelected && !result.correct) {
                btnClass = "bg-gradient-to-b from-rose-600 to-rose-700 border-rose-400 opacity-80";
              } else {
                btnClass = "bg-slate-800/80 border-slate-600 opacity-50";
              }
            } else if (isSelected) {
              btnClass = "bg-gradient-to-b from-amber-500 to-amber-600 border-amber-300 scale-105";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleAnswer(idx)}
                disabled={selectedIdx !== null}
                className={`${btnClass} rounded-2xl p-3 text-white font-bold text-sm transition-all active:scale-95 cursor-pointer border-2 flex items-start gap-2.5 text-left shadow-lg disabled:cursor-not-allowed`}
              >
                <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  {optionLabels[idx]}
                </span>
                <span className="leading-snug">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback jawaban benar */}
        {result?.correct && (
          <div className="mt-3 flex items-center justify-center gap-2 bg-emerald-900/80 border border-emerald-500/50 rounded-2xl px-4 py-2.5 animate-pulse">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-200 font-black text-sm">Benar! Susun balokmu sekarang 🏗️</span>
          </div>
        )}
      </div>
    </div>
  );
};
