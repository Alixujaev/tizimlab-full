// D-110: UI'da DD.MM.YYYY, API'da ISO YYYY-MM-DD.

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO sana yoki vaqtni DD.MM.YYYY ko'rinishiga o'giradi (sana qismi mahalliy vaqt bo'yicha). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** DD.MM.YYYY → YYYY-MM-DD; mavjud bo'lmagan sana (31.02.2026) yoki noto'g'ri format — `null`. */
export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m}-${d}`;
  const check = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(check.getTime()) && check.toISOString().slice(0, 10) === iso ? iso : null;
}
