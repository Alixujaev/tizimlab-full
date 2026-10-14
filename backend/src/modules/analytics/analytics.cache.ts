/**
 * D-164: og'ir analitika so'rovlari uchun qisqa xotira keshi. Kalit har doim kompaniya va ko'ruvchini
 * o'z ichiga oladi — boshqa tenant yoki boshqa doiradagi foydalanuvchi natijasi qaytmaydi.
 */
export const ANALYTICS_CACHE_TTL_MS = 45_000;
const MAX_ENTRIES = 500;

const store = new Map<string, { expires: number; value: Promise<unknown> }>();

export function analyticsCacheKey(
  companyId: string,
  viewerId: string,
  endpoint: string,
  params: unknown,
): string {
  return JSON.stringify([companyId, viewerId, endpoint, params]);
}

export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  if (store.size >= MAX_ENTRIES) {
    for (const [k, v] of store) if (v.expires <= now) store.delete(k);
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!);
  }
  const value = compute();
  store.set(key, { expires: now + ANALYTICS_CACHE_TTL_MS, value });
  // Xato natija keshda qolmasin
  value.catch(() => store.delete(key));
  return value;
}

export function clearAnalyticsCache(): void {
  store.clear();
}
