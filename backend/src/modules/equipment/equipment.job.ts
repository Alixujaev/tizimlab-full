import { withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { ANALYTICS_TZ } from '../analytics/analytics.period.js';
import { NOTIFICATION_TITLES } from '../notifications/notifications.events.js';
import { createNotification } from '../notifications/notifications.service.js';
import { EXPIRED_CATCHUP_DAYS, expiryThresholdFor } from '../reagents/reagents.job.js';

/**
 * D-175: apparat kalibrlash muddati ogohlantirishi — reaktiv muddati job'i (D-170) bilan bir xil qoidalar:
 * chegaralar 30/7/0 (`expiryThresholdFor`), eng shoshilinchi, 7 kunlik catch-up, advisory lock,
 * `equipment_calibration_notices` UNIQUE + ON CONFLICT DO NOTHING (dublikatsiz). Qamrov: `out_of_service`
 * bo'lmagan apparatlar (ishlatilmayotgan apparat uchun eslatma shart emas). Qabul qiluvchi: lab_head.
 */
export { expiryThresholdFor as calibrationThresholdFor };

export function calibrationMessage(name: string, due: string, daysLeft: number): string {
  const [y, m, d] = due.split('-');
  const date = `${d}.${m}.${y}`;
  if (daysLeft > 0) return `${name} — kalibrlash muddati: ${date} (${daysLeft} kun qoldi)`;
  if (daysLeft === 0) return `${name} — kalibrlash muddati bugun tugaydi (${date})`;
  return `${name} — kalibrlash muddati o‘tgan: ${date}`;
}

export interface CalibrationJobResult {
  executed: boolean;
  reason: 'locked' | 'success';
  notified: number;
}

export async function runCalibrationJob(
  options: { now?: Date } = {},
): Promise<CalibrationJobResult> {
  const now = options.now ?? new Date();
  return withTransaction(async (tx) => {
    const { rows: lock } = await tx.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtext('equipment_calibration_job')) AS locked`,
    );
    if (!lock[0]?.locked) return { executed: false, reason: 'locked', notified: 0 };

    const { rows } = await tx.query<{
      company_id: string;
      equipment_id: string;
      due: string;
      days_left: number;
      name: string;
    }>(
      `WITH today AS (SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d),
       candidates AS (
         SELECT e.id, e.company_id, e.name, e.calibration_due, (e.calibration_due - today.d) AS days_left
         FROM equipment e, today
         WHERE e.calibration_due IS NOT NULL
           AND e.status <> 'out_of_service'
           AND e.calibration_due <= today.d + 30
           AND e.calibration_due >= today.d - $3::int
       ),
       bucketed AS (
         SELECT c.*, CASE WHEN days_left > 7 THEN 30 WHEN days_left > 0 THEN 7 ELSE 0 END AS threshold
         FROM candidates c
       ),
       inserted AS (
         INSERT INTO equipment_calibration_notices (company_id, equipment_id, threshold, calibration_due, notified_at)
         SELECT company_id, id, threshold, calibration_due, $1::timestamptz FROM bucketed
         ON CONFLICT (equipment_id, threshold, calibration_due) DO NOTHING
         RETURNING equipment_id
       )
       SELECT b.company_id, b.id AS equipment_id, b.calibration_due::text AS due, b.days_left, b.name
       FROM inserted i JOIN bucketed b ON b.id = i.equipment_id
       ORDER BY b.days_left, b.name`,
      [now, ANALYTICS_TZ, EXPIRED_CATCHUP_DAYS],
    );

    for (const r of rows) {
      await createNotification(tx, {
        companyId: r.company_id,
        actorId: null,
        type: 'equipment_calibration_due',
        title: NOTIFICATION_TITLES.equipment_calibration_due,
        message: calibrationMessage(r.name, r.due, Number(r.days_left)),
        referenceId: r.equipment_id,
      });
    }
    return { executed: true, reason: 'success', notified: rows.length };
  });
}

let timer: NodeJS.Timeout | null = null;

export function startCalibrationScheduler(intervalMs = 24 * 60 * 60 * 1000): void {
  stopCalibrationScheduler();
  const tick = () =>
    runCalibrationJob().catch((err) => logger.error('Calibration job xatosi', { err }));
  void tick();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
}

export function stopCalibrationScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
