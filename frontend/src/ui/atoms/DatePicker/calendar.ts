// Kalendar hisob-kitoblari — vaqt zonasisiz (y, m, d butun sonlar), ISO YYYY-MM-DD.

export interface Ymd {
  y: number;
  m: number; // 0–11
  d: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = ({ y, m, d }: Ymd): string => `${y}-${pad(m + 1)}-${pad(d)}`;

export function fromIso(iso: string | null | undefined): Ymd | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

export const daysInMonth = (y: number, m: number): number => new Date(y, m + 1, 0).getDate();

/** Sanaga kun qo'shadi (oy/yil chegarasidan o'tadi). */
export function addDays(date: Ymd, days: number): Ymd {
  const js = new Date(date.y, date.m, date.d + days);
  return { y: js.getFullYear(), m: js.getMonth(), d: js.getDate() };
}

/** Oy qo'shadi; kun yangi oyda bo'lmasa — oxirgi kunga tushadi (31.01 + 1 oy = 28/29.02). */
export function addMonths(date: Ymd, months: number): Ymd {
  const first = new Date(date.y, date.m + months, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

/** Haftaning kuni, dushanbadan boshlab (0 = Du ... 6 = Ya). */
export const weekdayMon = (date: Ymd): number =>
  (new Date(date.y, date.m, date.d).getDay() + 6) % 7;

/** Oy ko'rinishi: 6 hafta × 7 kun (oldingi/keyingi oy kunlari bilan). */
export function monthGrid(y: number, m: number): Ymd[][] {
  const first = { y, m, d: 1 };
  let cursor = addDays(first, -weekdayMon(first));
  const weeks: Ymd[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: Ymd[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const sameDay = (a: Ymd | null, b: Ymd | null): boolean =>
  !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;

export function todayYmd(): Ymd {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

/** ISO qatorlar leksikografik tartibda solishtiriladi. */
export function inRange(iso: string, min?: string, max?: string): boolean {
  return (!min || iso >= min) && (!max || iso <= max);
}
