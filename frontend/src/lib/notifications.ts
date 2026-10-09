import type { TFunction } from 'i18next';
import type { NotificationDto } from '@/types';

/**
 * Sarlavha joriy tilda `type` bo'yicha; bazadagi `title` (bitta tilda saqlangan) — faqat legacy turlar uchun.
 */
export function notificationTitle(
  t: TFunction,
  n: Pick<NotificationDto, 'type' | 'title'>,
): string {
  const key = `notifications.types.${n.type}`;
  return t(key, { defaultValue: n.title });
}

/** Namunaga bog'liq turlar namuna sahifasiga olib boradi. */
export function notificationLink(n: Pick<NotificationDto, 'type' | 'referenceId'>): string | null {
  if (!n.referenceId) return null;
  return /^(sample|protocol)_/.test(n.type) ? `/samples/${n.referenceId}` : null;
}
