/**
 * D-174: reaktiv o'lchov birliklari — normallashtirish va konvertatsiya.
 * Oilalar: hajm (asos: ml), massa (asos: g), dona (asos: dona). Boshqa birliklar faqat aynan
 * bir xil yozilganda mos keladi (`other:<birlik>`). SQL `reagent_unit_family()` (021) bilan paritet testi bor.
 */
export type UnitFamily = 'volume' | 'mass' | 'count' | `other:${string}`;

interface KnownUnit {
  family: 'volume' | 'mass' | 'count';
  /** Asos birlikka ko'paytuvchi (ml, g, dona). */
  factor: number;
}

const KNOWN: Record<string, KnownUnit> = {};
const add = (family: KnownUnit['family'], factor: number, ...names: string[]) => {
  for (const n of names) KNOWN[n] = { family, factor };
};
add('volume', 1, 'ml', 'мл', 'millilitr', 'milliliter', 'millilitre');
add('volume', 1000, 'l', 'л', 'litr', 'liter', 'litre');
add('volume', 0.001, 'mkl', 'мкл', 'µl', 'ul');
add('mass', 1, 'g', 'г', 'gr', 'gramm', 'gram');
add('mass', 1000, 'kg', 'кг', 'kilogramm', 'kilogram');
add('mass', 0.001, 'mg', 'мг', 'milligramm', 'milligram');
add('count', 1, 'dona', 'ta', 'шт', 'pcs', 'pc', 'piece');

/** SQL bilan paritet testi uchun barcha ma'lum yozuvlar. */
export const KNOWN_UNIT_NAMES = Object.keys(KNOWN);

export function unitKey(raw: string): string {
  return raw.trim().replace(/\.$/, '').toLowerCase();
}

export interface NormalizedUnit {
  key: string;
  family: UnitFamily;
  factor: number;
}

export function normalizeUnit(raw: string | null | undefined): NormalizedUnit | null {
  if (raw === null || raw === undefined) return null;
  const key = unitKey(raw);
  if (!key) return null;
  const known = KNOWN[key];
  if (known) return { key, family: known.family, factor: known.factor };
  return { key, family: `other:${key}`, factor: 1 };
}

/** `from` birligidagi miqdorni `to` birligiga o'tkazadi; oilalar mos kelmasa `null`. */
export function convertUnit(qty: number, from: string, to: string): number | null {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (!a || !b || a.family !== b.family) return null;
  return roundQty((qty * a.factor) / b.factor);
}

/** numeric(14,4) bilan mos — suzuvchi nuqta qoldiqlarisiz. */
export function roundQty(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}
