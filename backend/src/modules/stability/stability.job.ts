import type pg from 'pg';
import { withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { NOTIFICATION_TITLES } from '../notifications/notifications.events.js';
import { createNotification } from '../notifications/notifications.service.js';

export interface StabilityJobOptions {
  now?: Date;
  pool?: pg.Pool;
}

export interface StabilityJobResult {
  executed: boolean;
  reason?: 'locked' | 'success';
  overdueCount: number;
  overdueNotifiedCount: number;
  dueSoonNotifiedCount: number;
}

interface OverdueCandidateRow {
  id: string;
  company_id: string;
  interval_tag: string;
  due_date: string | Date;
  status: string;
  assigned_to: string | null;
  overdue_notified_at: string | Date | null;
  sample_id: string;
  serial_number: string | null;
  substance_name: string;
}

interface DueSoonCandidateRow {
  id: string;
  company_id: string;
  interval_tag: string;
  due_date: string | Date;
  status: string;
  assigned_to: string | null;
  last_due_soon_notified_at: string | Date | null;
  sample_id: string;
  serial_number: string | null;
  substance_name: string;
}

/**
 * 6 soatlik stabilizatsiya tekshiruvlari eslatma va muddat monitoringi job'i (R-STAB-23..28).
 * - Multi-instance poygaga qarshi advisory lock (`pg_try_advisory_xact_lock`).
 * - Idempotent: `stability_overdue` faqat 1 marta; `stability_due_soon` 24 soatda ko'pi bilan 1 marta.
 * - Testlanadigan: `now` vaqtini tashqaridan qabul qiladi.
 */
export async function runStabilityReminderJob(
  options: StabilityJobOptions = {},
): Promise<StabilityJobResult> {
  const now = options.now ?? new Date();
  const currentDateStr = now.toISOString().slice(0, 10);

  return withTransaction(async (tx) => {
    // 1. Advisory lock tekshiruvi (multi-instance duplicate execution oldini oladi)
    const { rows: lockRows } = await tx.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtext('stability_reminder_job')) AS locked`,
    );

    if (!lockRows[0]?.locked) {
      logger.info('Stability reminder job advisory lock olinmadi, boshqa instansiya ishlamoqda');
      return {
        executed: false,
        reason: 'locked',
        overdueCount: 0,
        overdueNotifiedCount: 0,
        dueSoonNotifiedCount: 0,
      };
    }

    let overdueCount = 0;
    let overdueNotifiedCount = 0;
    let dueSoonNotifiedCount = 0;

    // 2. Muddati o'tgan checkpoint'lar (status <> 'completed' va due_date < today)
    const { rows: overdueRows } = await tx.query<OverdueCandidateRow>(
      `SELECT sc.id, sc.company_id, sc.interval_tag, sc.due_date, sc.status, sc.assigned_to,
              sc.overdue_notified_at,
              ss.sample_id, s.serial_number, s.substance_name
       FROM stability_checkpoints sc
       JOIN stability_studies ss ON ss.id = sc.study_id
       JOIN samples s ON s.id = ss.sample_id
       WHERE sc.status <> 'completed'
         AND sc.due_date < $1::date
       ORDER BY sc.due_date ASC`,
      [currentDateStr],
    );

    for (const cp of overdueRows) {
      // Statusni 'overdue' ga o'tkazish (R-STAB-24)
      if (cp.status !== 'overdue') {
        await tx.query(
          `UPDATE stability_checkpoints
           SET status = 'overdue'
           WHERE id = $1`,
          [cp.id],
        );
        overdueCount++;
      }

      // Xabarnoma yuborish (R-STAB-25): faqat 1 marta (overdue_notified_at IS NULL)
      if (!cp.overdue_notified_at) {
        await tx.query(
          `UPDATE stability_checkpoints
           SET overdue_notified_at = $1
           WHERE id = $2`,
          [now, cp.id],
        );

        const dueDateFormatted =
          typeof cp.due_date === 'string'
            ? cp.due_date.slice(0, 10)
            : cp.due_date.toISOString().slice(0, 10);

        await createNotification(tx, {
          companyId: cp.company_id,
          actorId: null,
          type: 'stability_overdue',
          title: NOTIFICATION_TITLES.stability_overdue,
          message: `${cp.substance_name} (${cp.interval_tag}) — muddat: ${dueDateFormatted}`,
          referenceId: cp.sample_id,
          context: { assignedTo: cp.assigned_to },
        });

        overdueNotifiedCount++;
      }
    }

    // 3. Muddati 14 kun ichida yetadigan checkpoint'lar (R-STAB-26..28)
    // due_date >= today AND due_date <= today + 14 days
    // Takroriy xabarnoma yo'q: last_due_soon_notified_at IS NULL OR last_due_soon_notified_at < now - 24 hours
    const { rows: dueSoonRows } = await tx.query<DueSoonCandidateRow>(
      `SELECT sc.id, sc.company_id, sc.interval_tag, sc.due_date, sc.status, sc.assigned_to,
              sc.last_due_soon_notified_at,
              ss.sample_id, s.serial_number, s.substance_name
       FROM stability_checkpoints sc
       JOIN stability_studies ss ON ss.id = sc.study_id
       JOIN samples s ON s.id = ss.sample_id
       WHERE sc.status <> 'completed'
         AND sc.due_date >= $1::date
         AND sc.due_date <= ($1::date + 14)
         AND (sc.last_due_soon_notified_at IS NULL OR sc.last_due_soon_notified_at < ($2::timestamptz - INTERVAL '24 hours'))
       ORDER BY sc.due_date ASC`,
      [currentDateStr, now],
    );

    for (const cp of dueSoonRows) {
      await tx.query(
        `UPDATE stability_checkpoints
         SET last_due_soon_notified_at = $1
         WHERE id = $2`,
        [now, cp.id],
      );

      const dueDateFormatted =
        typeof cp.due_date === 'string'
          ? cp.due_date.slice(0, 10)
          : cp.due_date.toISOString().slice(0, 10);

      await createNotification(tx, {
        companyId: cp.company_id,
        actorId: null,
        type: 'stability_due_soon',
        title: NOTIFICATION_TITLES.stability_due_soon,
        message: `${cp.substance_name} (${cp.interval_tag}) — muddat: ${dueDateFormatted}`,
        referenceId: cp.sample_id,
        context: { assignedTo: cp.assigned_to },
      });

      dueSoonNotifiedCount++;
    }

    return {
      executed: true,
      reason: 'success',
      overdueCount,
      overdueNotifiedCount,
      dueSoonNotifiedCount,
    };
  });
}

let stabilityJobTimer: NodeJS.Timeout | null = null;

/**
 * Server ishga tushganda 6 soatlik interval taymerini yoqish (R-STAB-23).
 */
export function startStabilityScheduler(intervalMs = 6 * 60 * 60 * 1000): void {
  stopStabilityScheduler();
  // Server start bo'lganda bir marta darhol xavfsiz ishga tushirish
  runStabilityReminderJob().catch((err) => {
    logger.error('Stability reminder job dastlabki xatosi', { err });
  });

  stabilityJobTimer = setInterval(() => {
    runStabilityReminderJob().catch((err) => {
      logger.error('Stability reminder job xatosi', { err });
    });
  }, intervalMs);
}

export function stopStabilityScheduler(): void {
  if (stabilityJobTimer) {
    clearInterval(stabilityJobTimer);
    stabilityJobTimer = null;
  }
}
