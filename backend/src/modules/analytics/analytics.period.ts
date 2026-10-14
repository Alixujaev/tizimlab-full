import { ValidationError } from '../../utils/errors.js';
import type { PeriodQuery } from './analytics.schemas.js';
import type { PeriodDto, ResolvedPeriod } from './analytics.types.js';

/**
 * D-161: kun chegaralari laboratoriya vaqt mintaqasida. Asia/Tashkent — doimiy UTC+5 (yozgi vaqt yo'q),
 * shuning uchun siljish konstanta; SQL'da ham shu nom ishlatiladi.
 */
export const ANALYTICS_TZ = 'Asia/Tashkent';
const TZ_OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;
/** ≤ 31 kun — kunlik trend, aks holda haftalik. */
export const DAILY_BUCKET_MAX_DAYS = 31;

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const dayStartUtc = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) - TZ_OFFSET_MS;

/** Berilgan instantdagi Toshkent kalendar sanasi (YYYY-MM-DD). */
export function localDate(at: Date): string {
  return isoDay(at.getTime() + TZ_OFFSET_MS);
}

export function addDays(iso: string, n: number): string {
  return isoDay(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS);
}

/** Preset yoki custom → aniq oraliq + bevosita oldingi teng uzunlikdagi oraliq. */
export function resolvePeriod(q: PeriodQuery, now: Date = new Date()): ResolvedPeriod {
  const today = localDate(now);
  let from: string;
  let to: string;
  if (q.period === 'custom') {
    from = q.from!;
    to = q.to!;
    if (to > today) {
      throw new ValidationError(undefined, [
        { path: 'query.to', message: 'Kelajak sanasi bo‘lishi mumkin emas' },
      ]);
    }
  } else {
    const n = Number.parseInt(q.period, 10);
    to = today;
    from = addDays(today, -(n - 1));
  }
  const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  const start = dayStartUtc(from);
  const end = dayStartUtc(addDays(to, 1));
  return {
    from,
    to,
    days,
    start: new Date(start),
    end: new Date(end),
    prevStart: new Date(start - days * DAY_MS),
    prevEnd: new Date(start),
    bucket: days <= DAILY_BUCKET_MAX_DAYS ? 'day' : 'week',
  };
}

export function periodDto(p: ResolvedPeriod): PeriodDto {
  return {
    from: p.from,
    to: p.to,
    days: p.days,
    bucket: p.bucket,
    previousFrom: addDays(p.from, -p.days),
    previousTo: addDays(p.from, -1),
  };
}

/** Haftaning dushanbasi (ISO hafta). */
function weekStart(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = yakshanba
  return addDays(iso, -((dow + 6) % 7));
}

/** Davrning barcha bucket'lari (bo'shlari 0 bilan to'ldirish uchun). */
export function bucketKeys(p: ResolvedPeriod): string[] {
  const keys: string[] = [];
  if (p.bucket === 'day') {
    for (let d = p.from; d <= p.to; d = addDays(d, 1)) keys.push(d);
  } else {
    for (let d = weekStart(p.from); d <= p.to; d = addDays(d, 7)) keys.push(d);
  }
  return keys;
}

export function bucketOf(p: ResolvedPeriod, localDay: string): string {
  return p.bucket === 'day' ? localDay : weekStart(localDay);
}

/** Mahalliy kunlar bo'yicha sonlar → bucket'lar bo'yicha to'liq qator. */
export function fillBuckets(
  p: ResolvedPeriod,
  rows: { day: string; value: number }[],
): { date: string; value: number }[] {
  const map = new Map(bucketKeys(p).map((k) => [k, 0]));
  for (const r of rows) {
    const k = bucketOf(p, r.day);
    if (map.has(k)) map.set(k, map.get(k)! + r.value);
  }
  return [...map].map(([date, value]) => ({ date, value }));
}
