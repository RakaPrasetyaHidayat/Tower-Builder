import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface ImportedQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
}

export interface QuestionImportResult {
  questions: ImportedQuestion[];
  answerKeyCount: number;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractQuestionDocument(file: File): Promise<QuestionImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text: string;

  if (extension === "pdf") {
    text = await extractPdfText(file);
  } else if (extension === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    throw new Error("Format belum didukung. Pilih file PDF atau Word .docx.");
  }

  const parsed = parseQuestionText(text);
  if (parsed.questions.length === 0) {
    throw new Error("Tidak ada soal pilihan ganda yang terbaca. Gunakan nomor soal dan opsi A-D yang jelas.");
  }

  return parsed;
}

async function extractPdfText(file: File): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: { y: number; parts: { x: number; width: number; text: string }[] }[] = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let line = lines.find((candidate) => Math.abs(candidate.y - y) < 3);
      if (!line) {
        line = { y, parts: [] };
        lines.push(line);
      }
      line.parts.push({ x, width: item.width, text: item.str });
    }

    pages.push(lines
      .sort((a, b) => b.y - a.y)
      .map((line) => line.parts
        .sort((a, b) => a.x - b.x)
        .reduce((value, part, index, parts) => {
          const previous = parts[index - 1];
          const needsSpace = previous && part.x - (previous.x + previous.width) > 1.5;
          return value + (needsSpace ? " " : "") + part.text;
        }, ""))
      .join("\n"));
  }

  await loadingTask.destroy();
  return pages.join("\n");
}

export function parseQuestionText(rawText: string): QuestionImportResult {
  type DraftQuestion = ImportedQuestion & { number: number; answerLetter?: number };
  const questions: DraftQuestion[] = [];
  const answerKey = new Map<number, number>();
  const lines = rawText.replace(/\u00a0/g, " ").replace(/\r/g, "\n").split("\n");
  let current: DraftQuestion | null = null;
  let readingAnswerKey = false;

  const finishQuestion = () => {
    if (!current?.text.trim()) return;
    current.options = Array.from({ length: 4 }, (_, index) => current?.options[index] ?? "");
    questions.push(current);
    current = null;
  };

  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    if (!line) continue;

    const inlineAnswer = line.match(/^\s*(?:kunci\s+)?jawaban\s*[:-]\s*([A-D])\b/i);
    if (current && inlineAnswer) {
      current.answerLetter = inlineAnswer[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }

    const answerHeading = line.match(/^\s*(?:kunci(?:\s+jawaban)?|jawaban|answer\s*key)\s*:?\s*(.*)$/i);
    if (answerHeading) {
      readingAnswerKey = true;
      const entries = answerHeading[1].matchAll(/(\d{1,3})\s*[).:-]?\s*([A-D])\b/gi);
      for (const [, number, letter] of entries) answerKey.set(Number(number), letter.toUpperCase().charCodeAt(0) - 65);
      continue;
    }

    if (readingAnswerKey) {
      const entries = line.matchAll(/(?:^|[,;\s])(\d{1,3})\s*[).:-]?\s*([A-D])(?:\b|$)/gi);
      let foundEntry = false;
      for (const [, number, letter] of entries) {
        answerKey.set(Number(number), letter.toUpperCase().charCodeAt(0) - 65);
        foundEntry = true;
      }
      if (foundEntry) continue;
      readingAnswerKey = false;
    }

    const questionHeading = line.match(/^\s*(?:soal\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i);
    if (questionHeading) {
      finishQuestion();
      current = {
        number: Number(questionHeading[1]),
        text: questionHeading[2].trim(),
        options: [],
        correctIndex: 0,
        category: "Umum",
      };
      continue;
    }

    const option = line.match(/^\s*(?:\(([A-D])\)|([A-D]))\s*[).:-]?\s+(.+?)\s*$/i);
    if (current && option) {
      const letter = (option[1] ?? option[2]).toUpperCase();
      const optionIndex = letter.charCodeAt(0) - 65;
      current.options[optionIndex] = option[3].trim();
      continue;
    }

    if (current && current.options.length === 0) {
      current.text = `${current.text} ${line}`.trim();
    } else if (current && current.options.length > 0) {
      const lastOptionIndex = current.options.length - 1;
      current.options[lastOptionIndex] = `${current.options[lastOptionIndex]} ${line}`.trim();
    }
  }

  finishQuestion();

  const finalized = questions.map(({ number, answerLetter, ...question }) => ({
    ...question,
    correctIndex: answerLetter ?? answerKey.get(number) ?? 0,
  }));

  return {
    questions: finalized,
    answerKeyCount: questions.filter((question) => question.answerLetter !== undefined || answerKey.has(question.number)).length,
  };
}