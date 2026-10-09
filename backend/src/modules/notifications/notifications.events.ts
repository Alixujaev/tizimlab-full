import type pg from 'pg';
import type { SampleLookup } from '../protocols/protocols.service.js';
import type { ProtocolRow, ProtocolStatus } from '../protocols/protocols.types.js';
import type { SampleRow } from '../samples/samples.types.js';
import { createNotification } from './notifications.service.js';
import type { NotificationType } from './notifications.types.js';

/**
 * Domen hodisalari → xabarnomalar (spec §9, D-13). `title` bazada bitta tilda saqlanadi (SCHEMA_DIFF R1);
 * frontend sarlavhani `type` bo'yicha joriy tilda ko'rsatadi, `message` — tilga bog'liq bo'lmagan tafsilot.
 */
export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  sample_assigned: 'Sizga yangi namuna biriktirildi',
  sample_approved: 'Namuna tasdiqlandi',
  sample_rejected: 'Namuna rad etildi',
  protocol_submitted: 'Protokol tasdiqlashga yuborildi',
  protocol_approved: 'Protokol tasdiqlandi',
  protocol_rejected: 'Protokol rad etildi',
  temperature_alert: 'Harorat chegaradan chiqdi',
  low_stock: 'Reaktiv zaxirasi kam qoldi',
  stability_due_soon: 'Stabilizatsiya muddati yaqinlashmoqda',
  stability_overdue: 'Stabilizatsiya muddati o‘tdi',
};

type SampleRef = Pick<
  SampleRow,
  'id' | 'company_id' | 'substance_name' | 'assigned_to' | 'created_by'
>;

function sampleMessage(sample: Pick<SampleRow, 'substance_name'>, reason?: string | null): string {
  return reason ? `${sample.substance_name} — ${reason}` : sample.substance_name;
}

export async function notifySampleAssigned(
  tx: pg.PoolClient,
  sample: SampleRef,
  actorId: string | null,
): Promise<void> {
  await createNotification(tx, {
    companyId: sample.company_id,
    actorId,
    type: 'sample_assigned',
    title: NOTIFICATION_TITLES.sample_assigned,
    message: sampleMessage(sample),
    referenceId: sample.id,
    context: { assignedTo: sample.assigned_to },
  });
}

/** Namuna `approved`/`rejected` ga o'tganda — yaratgan kontrolyor va biriktirilgan kimyogarga. */
export async function notifySampleDecision(
  tx: pg.PoolClient,
  sample: SampleRef,
  decision: 'approved' | 'rejected',
  actorId: string,
  reason?: string | null,
): Promise<void> {
  const type = decision === 'approved' ? 'sample_approved' : 'sample_rejected';
  await createNotification(tx, {
    companyId: sample.company_id,
    actorId,
    type,
    title: NOTIFICATION_TITLES[type],
    message: sampleMessage(sample, reason),
    referenceId: sample.id,
    context: { createdBy: sample.created_by, assignedTo: sample.assigned_to },
  });
}

const PROTOCOL_EVENTS: Partial<Record<ProtocolStatus, NotificationType>> = {
  submitted: 'protocol_submitted',
  approved: 'protocol_approved',
  rejected: 'protocol_rejected',
};

/**
 * Protokol statusi o'zgarganda. `standard`/`final` protokol tasdiqlansa/rad etilsa namuna ham
 * shu statusga o'tadi (D-14, D-15) — shuning uchun `sample_*` xabarnomasi ham shu yerda.
 * `finalized` uchun §9 da tur yo'q.
 */
export async function notifyProtocolStatus(
  tx: pg.PoolClient,
  protocol: ProtocolRow,
  toStatus: ProtocolStatus,
  sample: SampleLookup,
  actorId: string,
): Promise<void> {
  const type = PROTOCOL_EVENTS[toStatus];
  if (!type) return;
  const reason = toStatus === 'rejected' ? protocol.rejection_reason : null;
  await createNotification(tx, {
    companyId: protocol.company_id,
    actorId,
    type,
    title: NOTIFICATION_TITLES[type],
    message: sampleMessage(sample, reason),
    // Havola namunaga: protokol namuna sahifasida ko'rsatiladi
    referenceId: sample.id,
    context: { assignedTo: sample.assigned_to },
  });

  const drivesSample = protocol.protocol_role === 'standard' || protocol.protocol_role === 'final';
  if (drivesSample && (toStatus === 'approved' || toStatus === 'rejected')) {
    await notifySampleDecision(tx, sample, toStatus, actorId, reason);
  }
}
