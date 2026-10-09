import type pg from 'pg';
import { onCommit, query } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import type { ListNotificationsQuery } from './notifications.schemas.js';
import type {
  NotificationDto,
  NotificationRow,
  NotificationType,
  NotifyInput,
  RecipientRule,
} from './notifications.types.js';

/** Yetkazish kanali (Socket.IO, keyinroq Telegram — P11). Faqat COMMIT dan keyin chaqiriladi. */
export type NotificationChannel = (userId: string, notification: NotificationDto) => void;

const channels = new Map<string, NotificationChannel>();

/** Kanalni ro'yxatdan o'tkazadi; `null` — o'chiradi (testlar va graceful shutdown uchun). */
export function setNotificationChannel(name: string, channel: NotificationChannel | null): void {
  if (channel) channels.set(name, channel);
  else channels.delete(name);
}

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    referenceId: row.reference_id,
    isRead: row.is_read,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** D-13 (+ D-04): har tur uchun qabul qiluvchilar. */
export function recipientRule(
  type: NotificationType,
  ctx: NotifyInput['context'] = {},
): RecipientRule {
  switch (type) {
    case 'sample_assigned':
    case 'protocol_approved':
    case 'protocol_rejected':
      return { users: [ctx.assignedTo], roles: [] };
    case 'sample_approved':
    case 'sample_rejected':
      return { users: [ctx.createdBy, ctx.assignedTo], roles: [] };
    case 'protocol_submitted':
      return { users: [], roles: ['lab_head'] };
    case 'temperature_alert':
    case 'low_stock':
      return { users: [], roles: ['lab_head', 'admin'] };
    case 'stability_due_soon':
    case 'stability_overdue':
      return { users: [ctx.assignedTo], roles: ['lab_head'] };
  }
}

/**
 * Yagona kirish nuqtasi (R-NOTIF-21): qabul qiluvchilarni aniqlaydi, `notifications` ga yozadi va
 * COMMIT dan keyin kanallarga (socket) yuboradi. Qabul qiluvchilar FAQAT shu kompaniyaning faol
 * foydalanuvchilari, harakat egasi chiqarib tashlanadi — ikkalasi ham SQL'da majburlanadi (D-13, D-12).
 */
export async function createNotification(
  db: pg.Pool | pg.PoolClient,
  input: NotifyInput,
): Promise<NotificationDto[]> {
  const rule = recipientRule(input.type, input.context);
  const userIds = rule.users.filter((id): id is string => !!id);
  if (userIds.length === 0 && rule.roles.length === 0) return [];

  const { rows } = await db.query<NotificationRow>(
    `INSERT INTO notifications (company_id, user_id, type, title, message, reference_id)
     SELECT $1, u.id, $2::notification_type, $3, $4, $5
     FROM users u
     WHERE u.company_id = $1
       AND u.is_active = true
       AND (u.id = ANY($6::uuid[]) OR u.role::text = ANY($7::text[]))
       AND ($8::uuid IS NULL OR u.id <> $8::uuid)
     RETURNING *`,
    [
      input.companyId,
      input.type,
      input.title.slice(0, 255),
      input.message,
      input.referenceId ?? null,
      userIds,
      rule.roles,
      input.actorId,
    ],
  );

  const dtos = rows.map(toNotificationDto);
  if (dtos.length > 0) {
    onCommit(db, () => {
      for (const [i, dto] of dtos.entries()) {
        for (const [name, channel] of channels) {
          try {
            channel(rows[i]!.user_id, dto);
          } catch (err) {
            logger.error(`Xabarnoma kanali xatosi (${name})`, { err });
          }
        }
      }
    });
  }
  return dtos;
}

export async function listNotifications(
  companyId: string,
  userId: string,
  q: ListNotificationsQuery,
): Promise<PaginatedResult<NotificationDto>> {
  const params = [companyId, userId, q.unread ?? false];
  const [list, count] = await Promise.all([
    query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE company_id = $1 AND user_id = $2 AND ($3::boolean = false OR is_read = false)
       ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`,
      [...params, q.limit, toOffset(q)],
    ),
    query<{ total: string }>(
      `SELECT count(*) AS total FROM notifications
       WHERE company_id = $1 AND user_id = $2 AND ($3::boolean = false OR is_read = false)`,
      params,
    ),
  ]);
  return {
    items: list.rows.map(toNotificationDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getUnreadCount(companyId: string, userId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*) AS count FROM notifications
     WHERE company_id = $1 AND user_id = $2 AND is_read = false`,
    [companyId, userId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Faqat o'z xabarnomasi; boshqasiniki (yoki boshqa kompaniyaniki) — 404 (mavjudlik yashiriladi). */
export async function markRead(
  companyId: string,
  userId: string,
  id: string,
): Promise<NotificationDto> {
  const { rows } = await query<NotificationRow>(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND company_id = $2 AND user_id = $3
     RETURNING *`,
    [id, companyId, userId],
  );
  if (!rows[0]) throw new NotFoundError('Xabarnoma topilmadi');
  return toNotificationDto(rows[0]);
}

export async function markAllRead(companyId: string, userId: string): Promise<{ updated: number }> {
  const res = await query(
    `UPDATE notifications SET is_read = true
     WHERE company_id = $1 AND user_id = $2 AND is_read = false`,
    [companyId, userId],
  );
  return { updated: res.rowCount ?? 0 };
}
