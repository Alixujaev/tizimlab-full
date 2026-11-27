import { toApiError } from '@/api/client';
import i18n from '@/i18n';
import { errorMessage } from '@/lib/queryClient';

/** Son: null → "—"; ortiqcha nollarsiz, ko'pi bilan `digits` kasr. */
export function fmtNum(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return String(Number(v.toFixed(digits)));
}

/** Foiz og'ishi: ishora bilan (+1.2%). */
export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = v.toFixed(1);
  return `${v > 0 ? '+' : ''}${s}%`;
}

/** Forma qiymati → son (vergul ham qabul); bo'sh → null; noto'g'ri → NaN. */
export function parseNum(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** OOS/chat xato kodi → `oos.errors.<CODE>` (bo'lmasa umumiy xato matni). Inline ko'rsatish uchun. */
export function oosErrorText(err: unknown): string {
  const code = toApiError(err)?.code;
  const key = `oos.errors.${code ?? ''}`;
  return code && i18n.exists(key) ? i18n.t(key) : errorMessage(err);
}
