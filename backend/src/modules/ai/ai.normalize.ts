import { normalizeUnit } from '../../utils/units.js';

/**
 * D-180: AI qaytargan xom matnni DETERMINISTIK normallashtirish. Model sanani "qanday yozilgan bo'lsa shunday"
 * qaytaradi, ISO ga o'girish shu yerda — bir xil kirish har doim bir xil natija beradi.
 * Natija faqat sana-satr (`YYYY-MM-DD`), `Date` obyekti emas — UTC+5 siljishi (D-168) qaytmaydi.
 */

export type Confidence = 'high' | 'medium' | 'low';

const pad = (n: number) => String(n).padStart(2, '0');

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoIfValid(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > lastDayOfMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 2 xonali yil: 00–69 → 20xx, 70–99 → 19xx (etiketkalardagi odatiy qisqartma). */
function fullYear(raw: string): number {
  const n = Number(raw);
  if (raw.length === 2) return n < 70 ? 2000 + n : 1900 + n;
  return n;
}

const MONTHS: Record<string, number> = {};
const months = (n: number, ...names: string[]) => names.forEach((m) => (MONTHS[m] = n));
months(1, 'jan', 'january', 'янв', 'январь', 'января', 'yanvar');
months(2, 'feb', 'february', 'фев', 'февраль', 'февраля', 'fevral');
months(3, 'mar', 'march', 'мар', 'март', 'марта', 'mart');
months(4, 'apr', 'april', 'апр', 'апрель', 'апреля', 'aprel');
months(5, 'may', 'май', 'мая', 'may');
months(6, 'jun', 'june', 'июн', 'июнь', 'июня', 'iyun');
months(7, 'jul', 'july', 'июл', 'июль', 'июля', 'iyul');
months(8, 'aug', 'august', 'авг', 'август', 'августа', 'avgust');
months(9, 'sep', 'sept', 'september', 'сен', 'сентябрь', 'сентября', 'sentabr');
months(10, 'oct', 'october', 'окт', 'октябрь', 'октября', 'oktabr');
months(11, 'nov', 'november', 'ноя', 'ноябрь', 'ноября', 'noyabr');
months(12, 'dec', 'december', 'дек', 'декабрь', 'декабря', 'dekabr');

/**
 * Qo'llab-quvvatlanadigan yozuvlar (kun-oy tartibi — O'zbekiston/MDH odati, oy-kun "taxmin qilinmaydi"):
 *   2027-05-31, 2027/05/31, 31.05.2027, 31/05/2027, 31-05-2027, 31.05.27,
 *   05/2027, 05.2027, 2027-05, 2027/05 (→ oyning oxirgi kuni), "May 2027", "31 May 2027", "май 2027".
 * Tanilmasa yoki kalendarda yo'q bo'lsa — `null`.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[,]/g, '');
  if (!s) return null;
  let m: RegExpMatchArray | null;

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD (ixtiyoriy vaqt qismi bilan)
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[t ].*)?$/))) {
    return isoIfValid(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY / DD.MM.YY
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    return isoIfValid(fullYear(m[3]!), Number(m[2]), Number(m[1]));
  }
  // YYYY-MM / YYYY/MM / YYYY.MM → oyning oxirgi kuni
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? isoIfValid(y, mo, lastDayOfMonth(y, mo)) : null;
  }
  // MM/YYYY / MM.YYYY / MM-YYYY / MM/YY → oyning oxirgi kuni
  if ((m = s.match(/^(\d{1,2})[-/.](\d{4}|\d{2})$/))) {
    const y = fullYear(m[2]!);
    const mo = Number(m[1]);
    return mo >= 1 && mo <= 12 ? isoIfValid(y, mo, lastDayOfMonth(y, mo)) : null;
  }
  // "31 May 2027" / "31 мая 2027"
  if ((m = s.match(/^(\d{1,2})[ .-]([a-zа-яё]+)\.?[ .-](\d{4})$/))) {
    const mo = MONTHS[m[2]!];
    return mo ? isoIfValid(Number(m[3]), mo, Number(m[1])) : null;
  }
  // "May 2027" / "май 2027" / "may-2027" → oyning oxirgi kuni
  if ((m = s.match(/^([a-zа-яё]+)\.?[ .-](\d{4})$/))) {
    const mo = MONTHS[m[1]!];
    const y = Number(m[2]);
    return mo ? isoIfValid(y, mo, lastDayOfMonth(y, mo)) : null;
  }
  return null;
}

/** Kanonik yozuv: oila + ko'paytuvchi → ko'rsatiladigan birlik (Kirill "мл" → "ml"). */
const CANONICAL: Record<string, string> = {
  'volume:1': 'ml',
  'volume:1000': 'l',
  'volume:0.001': 'mkl',
  'mass:1': 'g',
  'mass:1000': 'kg',
  'mass:0.001': 'mg',
  'count:1': 'dona',
};

/** D-174 ga mos birlik; noma'lum (hajm/massa/dona oilasidan tashqari) — `null` (taxmin qilinmaydi). */
export function normalizeAiUnit(raw: string | null | undefined): string | null {
  const n = normalizeUnit(raw);
  if (!n || n.family.startsWith('other:')) return null;
  return CANONICAL[`${n.family}:${n.factor}`] ?? null;
}

/** "1 000,5" / "1,000.5" / "25" → son; manfiy yoki son bo'lmasa `null`. */
export function normalizeNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
  let s = raw.trim().replace(/\s+/g, '');
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Bo'sh/faqat probel matn — `null`; ortiqcha probellar siqiladi; uzunlik cheklanadi. */
export function normalizeText(raw: string | null | undefined, max = 255): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** Normallashtirishdan o'tmagan qiymat — `null` + `low`; aks holda modelning ishonchi saqlanadi. */
export function lowerIfInvalid<T>(
  value: T | null,
  raw: unknown,
  confidence: Confidence,
): Confidence {
  if (raw !== null && raw !== undefined && raw !== '' && value === null) return 'low';
  return confidence;
}
