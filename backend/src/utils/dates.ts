/**
 * PostgreSQL `date` qiymatini ISO kun (`YYYY-MM-DD`) ga o'giradi.
 * `pg` drayveri `date` ni lokal yarim tundagi JS `Date` sifatida qaytaradi: `String(d).slice(0, 10)`
 * "Sun Feb 01" beradi, `toISOString()` esa UTC+ zonalarda bir kun orqaga suradi — shuning uchun lokal komponentlar.
 */
export function toIsoDay(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match ? match[0] : null;
}
