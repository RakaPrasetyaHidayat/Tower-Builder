import React, { useState } from "react";
import { Brain, Plus, Trash2, CheckCircle2, AlertCircle, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

export interface CustomQuestion {
  id: number;
  text: string;
  options: string[]; // selalu 4 elemen
  correctIndex: number;
  category: string;
}

interface QuestionManagerProps {
  questions: CustomQuestion[];
  onChange: (questions: CustomQuestion[]) => void;
  onSave: (questions: CustomQuestion[]) => void;
  disabled?: boolean;
}

const EMPTY_QUESTION = (): CustomQuestion => ({
  id: Date.now(),
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  category: "Umum",
});

export const QuestionManager: React.FC<QuestionManagerProps> = ({
  questions,
  onChange,
  onSave,
  disabled = false,
}) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(questions.length === 0 ? 0 : null);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const addQuestion = () => {
    const newQ = EMPTY_QUESTION();
    const newList = [...questions, newQ];
    onChange(newList);
    setExpandedIdx(newList.length - 1);
  };

  const removeQuestion = (idx: number) => {
    const newList = questions.filter((_, i) => i !== idx);
    onChange(newList);
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const updateQuestion = (idx: number, field: keyof CustomQuestion, value: any) => {
    const newList = questions.map((q, i) =>
      i === idx ? { ...q, [field]: value } : q
    );
    onChange(newList);
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    const newList = questions.map((q, i) => {
      if (i !== qIdx) return q;
      const newOptions = [...q.options];
      newOptions[optIdx] = value;
      return { ...q, options: newOptions };
    });
    onChange(newList);
  };

  const handleSave = () => {
    // Validasi: semua soal harus punya teks dan 4 opsi terisi
    const valid = questions.every(
      (q) => q.text.trim() && q.options.every((o) => o.trim())
    );
    if (!valid) return;
    onSave(questions);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const validCount = questions.filter(
    (q) => q.text.trim() && q.options.every((o) => o.trim())
  ).length;

  const LABEL = ["A", "B", "C", "D"];
  const CATEGORIES = ["Umum", "Sejarah", "Sains", "Matematika", "Bahasa", "IPS", "Teknologi", "Seni"];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Soal Kustom Sultan
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            validCount === questions.length && questions.length > 0
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-slate-100 text-slate-500"
          }`}>
            {validCount}/{questions.length} valid
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="text-[11px] text-slate-500 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 leading-relaxed">
        Hanya soal yang dibuat dan disimpan Sultan yang digunakan. Tidak ada soal otomatis atau bank soal bawaan.
      </div>

      {/* Daftar soal */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {questions.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-xs">
            Belum ada soal. Tekan "+ Tambah Soal" untuk mulai.
          </div>
        )}

        {questions.map((q, idx) => {
          const isOpen = expandedIdx === idx;
          const isValid = q.text.trim() && q.options.every((o) => o.trim());

          return (
            <div
              key={q.id}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isValid ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"
              }`}
            >
              {/* Soal header row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span
                  className="flex-1 text-xs text-slate-700 truncate cursor-pointer font-medium"
                  onClick={() => setExpandedIdx(isOpen ? null : idx)}
                >
                  {q.text.trim() || <span className="text-slate-400 italic">Soal belum diisi...</span>}
                </span>
                {isValid
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                }
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isOpen ? null : idx)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Expanded editor */}
              {isOpen && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 pt-2.5">
                  {/* Kategori */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 w-16 shrink-0">Kategori</label>
                    <select
                      value={q.category}
                      onChange={(e) => updateQuestion(idx, "category", e.target.value)}
                      disabled={disabled}
                      className="flex-1 text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Teks soal */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Pertanyaan *</label>
                    <textarea
                      value={q.text}
                      onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                      disabled={disabled}
                      placeholder="Tulis pertanyaan di sini..."
                      rows={2}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 placeholder-slate-300 focus:outline-none focus:border-indigo-400 resize-none"
                    />
                  </div>

                  {/* 4 Pilihan */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1.5">
                      Pilihan Jawaban * <span className="text-indigo-600">(klik radio = tandai benar)</span>
                    </label>
                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={q.correctIndex === optIdx}
                            onChange={() => updateQuestion(idx, "correctIndex", optIdx)}
                            disabled={disabled}
                            className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                            q.correctIndex === optIdx
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {LABEL[optIdx]}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                            disabled={disabled}
                            placeholder={`Pilihan ${LABEL[optIdx]}...`}
                            className={`flex-1 text-xs rounded-lg border px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 ${
                              q.correctIndex === optIdx
                                ? "border-indigo-300 bg-indigo-50/50 text-indigo-800"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {!disabled && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={addQuestion}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Soal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={validCount !== questions.length}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
              savedFeedback
                ? "bg-emerald-500 text-white border border-emerald-400"
                : validCount !== questions.length
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {savedFeedback ? "Tersimpan!" : "Simpan Soal"}
          </button>
        </div>
      )}

      {questions.length > 0 && validCount < questions.length && (
        <p className="text-[10px] text-amber-600 text-center">
          ⚠️ {questions.length - validCount} soal belum lengkap (teks atau pilihan kosong)
        </p>
      )}
    </div>
  );
};
