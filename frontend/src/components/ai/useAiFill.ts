import { useCallback, useState } from 'react';
import type { AiConfidence, AiExtractionDto, AiReviewRef } from '@/types';

/** Forma maydoni: joriy qiymat va setter. */
export type AiFieldBinding = readonly [value: string, set: (v: string) => void];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Sana maydonlari — AI qiymati faqat YYYY-MM-DD bo'lsa qabul qilinadi. */
const isDateKey = (key: string) => /(At|Date|End)$/.test(key);

export interface AiFieldMark {
  confidence: AiConfidence | null;
}

/**
 * P18 (D-181): AI taklifini formaga qo'llash holati.
 * - Faqat qiymati bor (null emas) maydonlar; foydalanuvchi o'zi yozgan maydon USTIDAN YOZILMAYDI.
 * - To'ldirilgan maydon "AI" belgisi bilan; past/o'rta ishonch — "Tekshiring".
 * - Foydalanuvchi maydonni tahrirlasa belgi olib tashlanadi (endi bu inson qiymati).
 * - Saqlashda `reviewRef` — faqat muvaffaqiyatli (status=ok, sifat past emas) ekstraksiya bo'lsa.
 */
export function useAiFill() {
  const [extraction, setExtraction] = useState<AiExtractionDto | null>(null);
  const [marks, setMarks] = useState<Record<string, AiFieldMark>>({});
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  const apply = useCallback(
    (x: AiExtractionDto, bindings: Record<string, AiFieldBinding>): number => {
      setExtraction(x);
      const next: Record<string, AiFieldMark> = {};
      for (const [key, [current, set]] of Object.entries(bindings)) {
        const field = x.fields[key];
        if (!field || field.value === null || field.value === undefined) continue;
        const value = String(field.value).trim();
        if (!value) continue;
        if (isDateKey(key) && !ISO_DAY.test(value)) continue;
        // Inson yozgan qiymat saqlanadi; bo'sh yoki avval AI to'ldirgan maydon yangilanadi
        if (current.trim() && touched.has(key)) continue;
        set(value);
        next[key] = { confidence: field.confidence };
      }
      setMarks(next);
      return Object.keys(next).length;
    },
    [touched],
  );

  const onUserEdit = useCallback((key: string) => {
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    setMarks((prev) => {
      if (!(key in prev)) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  }, []);

  const reset = useCallback(() => {
    setExtraction(null);
    setMarks({});
    setTouched(new Set());
  }, []);

  const reviewRef: AiReviewRef | undefined =
    extraction && extraction.status === 'ok' && !isPoorQuality(extraction)
      ? { extractionId: extraction.extractionId }
      : undefined;

  return { extraction, marks, apply, onUserEdit, reset, reviewRef };
}

/** Past sifat: `imageQuality` poor/unreadable yoki `AI_POOR_QUALITY`. */
export function isPoorQuality(x: AiExtractionDto): boolean {
  return (
    x.imageQuality === 'poor' ||
    x.imageQuality === 'unreadable' ||
    x.errorCode === 'AI_POOR_QUALITY'
  );
}
