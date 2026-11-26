import { withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { ANALYTICS_TZ } from '../analytics/analytics.period.js';
import { NOTIFICATION_TITLES } from '../notifications/notifications.events.js';
import { createNotification } from '../notifications/notifications.service.js';

/**
 * D-170: reaktiv yaroqlilik muddati ogohlantirishi (TZ §3.2).
 *
 * Chegaralar (laboratoriya kuni — Asia/Tashkent): qolgan kun 8..30 → `30`, 1..7 → `7`, ≤ 0 → `0`.
 * Bir reaktiv uchun faqat eng shoshilinch chegara yuboriladi (masalan, 5 kun qolganda kiritilgan reaktivga
 * 30-kunlik xabar ketmaydi). Muddati `EXPIRED_CATCHUP_DAYS` kundan oldin o'tganlar uchun xabar yo'q —
 * birinchi ishga tushishda eski reaktivlar bo'yicha xabar "bo'roni" bo'lmasin; server bir necha kun
 * ishlamay qolsa ham o'tkazib yuborilgan `0` xabari yetkaziladi.
 * Qamrov: rad etilmagan (`pending`/`approved`), qoldig'i > 0 reaktivlar.
 */
export const EXPIRY_THRESHOLDS = [30, 7, 0] as const;
export const EXPIRED_CATCHUP_DAYS = 7;

export type ExpiryThreshold = (typeof EXPIRY_THRESHOLDS)[number];

/** Qolgan kunlar → chegara (yoki ogohlantirish kerak emas). Sof funksiya — chegaralar unit-testlanadi. */
export function expiryThresholdFor(daysLeft: number): ExpiryThreshold | null {
  if (daysLeft > 30) return null;
  if (daysLeft > 7) return 30;
  if (daysLeft > 0) return 7;
  if (daysLeft >= -EXPIRED_CATCHUP_DAYS) return 0;
  return null;
}

export function expiryMessage(name: string, expiresAt: string, daysLeft: number): string {
  const [y, m, d] = expiresAt.split('-');
  const date = `${d}.${m}.${y}`;
  if (daysLeft > 0) return `${name} — muddat: ${date} (${daysLeft} kun qoldi)`;
  if (daysLeft === 0) return `${name} — muddat bugun tugaydi (${date})`;
  return `${name} — muddati o‘tgan: ${date}`;
}

export interface ReagentExpiryJobResult {
  executed: boolean;
  reason: 'locked' | 'success';
  notified: number;
}

interface NoticeRow {
  company_id: string;
  reagent_id: string;
  threshold: number;
  expires_at: string;
  days_left: number;
  name: string;
}

export async function runReagentExpiryJob(
  options: { now?: Date } = {},
): Promise<ReagentExpiryJobResult> {
  const now = options.now ?? new Date();

  return withTransaction(async (tx) => {
    // Ko'p instansiyada bir vaqtda faqat bittasi ishlaydi; qolganlari darhol chiqadi.
    const { rows: lock } = await tx.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtext('reagent_expiry_job')) AS locked`,
    );
    if (!lock[0]?.locked) {
      logger.info('Reagent expiry job: advisory lock band, boshqa instansiya ishlamoqda');
      return { executed: false, reason: 'locked', notified: 0 };
    }

    // Chegara SQL'da `expiryThresholdFor` bilan bir xil; INSERT ... ON CONFLICT DO NOTHING RETURNING
    // faqat yangi (hali yuborilmagan) qatorlarni qaytaradi — takroriy xabar bo'lmaydi.
    const { rows } = await tx.query<NoticeRow>(
      `WITH today AS (SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d),
       candidates AS (
         SELECT r.id, r.company_id, r.name, r.expires_at, (r.expires_at - today.d) AS days_left
         FROM reagents r, today
         WHERE r.expires_at IS NOT NULL
           AND r.approval_status <> 'rejected'
           AND r.quantity > 0
           AND r.expires_at <= today.d + 30
           AND r.expires_at >= today.d - $3::int
       ),
       bucketed AS (
         SELECT c.*, CASE WHEN days_left > 7 THEN 30 WHEN days_left > 0 THEN 7 ELSE 0 END AS threshold
         FROM candidates c
       ),
       inserted AS (
         INSERT INTO reagent_expiry_notices (company_id, reagent_id, threshold, expires_at, notified_at)
         SELECT company_id, id, threshold, expires_at, $1::timestamptz FROM bucketed
         ON CONFLICT (reagent_id, threshold, expires_at) DO NOTHING
         RETURNING company_id, reagent_id, threshold, expires_at
       )
       SELECT i.company_id, i.reagent_id, i.threshold, i.expires_at::text AS expires_at,
              b.days_left, b.name
       FROM inserted i JOIN bucketed b ON b.id = i.reagent_id
       ORDER BY b.days_left, b.name`,
      [now, ANALYTICS_TZ, EXPIRED_CATCHUP_DAYS],
    );

    for (const r of rows) {
      await createNotification(tx, {
        companyId: r.company_id,
        actorId: null,
        type: 'reagent_expiring',
        title: NOTIFICATION_TITLES.reagent_expiring,
        message: expiryMessage(r.name, r.expires_at, Number(r.days_left)),
        referenceId: r.reagent_id,
      });
    }

    return { executed: true, reason: 'success', notified: rows.length };
  });
}

let timer: NodeJS.Timeout | null = null;

/** Kunlik (standart 24 soat) taymer + ishga tushganda bir marta. Idempotent — tez-tez ishlasa ham xavfsiz. */
export function startReagentExpiryScheduler(intervalMs = 24 * 60 * 60 * 1000): void {
  stopReagentExpiryScheduler();
  const tick = () =>
    runReagentExpiryJob().catch((err) => logger.error('Reagent expiry job xatosi', { err }));
  void tick();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
}

export function stopReagentExpiryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
