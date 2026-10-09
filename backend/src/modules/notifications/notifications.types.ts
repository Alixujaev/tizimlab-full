import type { Role } from '../auth/auth.types.js';

/** Ilova yaratadigan turlar — spec §9 dagi 10 tur (legacy enum qiymatlari bu yerda yo'q, R-NOTIF-11). */
export const NOTIFICATION_TYPES = [
  'sample_assigned',
  'sample_approved',
  'sample_rejected',
  'protocol_submitted',
  'protocol_approved',
  'protocol_rejected',
  'temperature_alert',
  'low_stock',
  'stability_due_soon',
  'stability_overdue',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Bazadagi qiymat legacy tur ham bo'lishi mumkin (ETL qatorlari). */
export type StoredNotificationType =
  NotificationType | 'sample_created' | 'sample_overdue' | 'general';

export interface NotificationRow {
  id: string;
  company_id: string;
  user_id: string;
  type: StoredNotificationType;
  title: string;
  message: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: Date;
}

export interface NotificationDto {
  id: string;
  type: StoredNotificationType;
  title: string;
  message: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Qabul qiluvchilar qoidasi (D-13, D-04): aniq foydalanuvchilar va/yoki kompaniyadagi rollar.
 * `users` — hodisaga bog'liq shaxslar (masalan, biriktirilgan kimyogar), `null` lar e'tiborsiz qoldiriladi.
 */
export interface RecipientRule {
  users: (string | null | undefined)[];
  roles: Role[];
}

export interface NotifyInput {
  companyId: string;
  /** Harakatni bajargan foydalanuvchi — unga xabar yuborilmaydi (D-13). Tizim job'larida `null`. */
  actorId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string | null;
  /** Hodisaga bog'liq shaxslar; qaysi biri ishlatilishini tur bo'yicha qoida hal qiladi. */
  context?: {
    assignedTo?: string | null;
    createdBy?: string | null;
  };
}
