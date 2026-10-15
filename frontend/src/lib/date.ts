// D-110: UI'da DD.MM.YYYY, API'da ISO YYYY-MM-DD.
import i18n from '@/i18n';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO sana yoki vaqtni DD.MM.YYYY (uz/ru) yoki MM/DD/YYYY (en) ko'rinishiga o'giradi. */
export function formatDate(iso: string | number | Date | null | undefined, lng?: string): string {
  if (!iso) return '—';
  const currentLng = (lng || i18n.language || 'uz').slice(0, 2).toLowerCase();

  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    if (currentLng === 'en') return `${m}/${d}/${y}`;
    return `${d}.${m}.${y}`;
  }

  const date = typeof iso === 'object' && 'getTime' in iso ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  if (currentLng === 'en') {
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
  }
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/**
 * Sana va vaqtni tanlangan til lokaliga mos formatlaydi (Intl bilan):
 * - uz: 15.10.2026 12:09 (24 soat)
 * - ru: 15.10.2026 12:09 (24 soat)
 * - en: 10/15/2026 12:09 PM (12 soat)
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  lng?: string,
): string {
  if (!dateInput) return '—';
  const d =
    typeof dateInput === 'object' && 'getTime' in dateInput ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';

  const currentLng = (lng || i18n.language || 'uz').slice(0, 2).toLowerCase();

  if (currentLng === 'en') {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const parts = formatter.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const dayPeriod = get('dayPeriod');
    return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')} ${dayPeriod}`.trim();
  }

  const formatter = new Intl.DateTimeFormat(currentLng === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
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
