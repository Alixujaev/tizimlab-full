import { describe, expect, it } from 'vitest';
import { recipientRule } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import {
  formatTelegramNotification,
  getNotificationActionUrl,
} from '../src/modules/telegram/telegram.service.js';

/** P17 — kalibrlash va sarf yetishmovchiligi xabarlari Telegram'da (mavjud kanal, yangi callback yo'q). */

const dto = (type: string, referenceId: string | null): NotificationDto =>
  ({
    id: 'n',
    type,
    title: 't',
    message: 'Mufel — 3 kun',
    referenceId,
    isRead: false,
    createdAt: '',
  }) as NotificationDto;

describe('P17 Telegram xabarnomalari', () => {
  it('qabul qiluvchi — faqat lab_head', () => {
    expect(recipientRule('equipment_calibration_due')).toEqual({ users: [], roles: ['lab_head'] });
    expect(recipientRule('reagent_shortfall')).toEqual({ users: [], roles: ['lab_head'] });
  });

  it('"Ko‘rish" havolasi: kalibrlash → /equipment/:id, yetishmovchilik → namuna sahifasi', () => {
    expect(
      getNotificationActionUrl(dto('equipment_calibration_due', 'e1'), 'https://lab.x.uz'),
    ).toEqual({
      path: '/equipment/e1',
      url: 'https://lab.x.uz/equipment/e1?startapp=equipment_e1',
      startapp: 'equipment_e1',
    });
    expect(getNotificationActionUrl(dto('reagent_shortfall', 's1'), 'https://lab.x.uz')?.path).toBe(
      '/samples/s1',
    );
  });

  it('sarlavha uch tilda', () => {
    expect(formatTelegramNotification(dto('equipment_calibration_due', 'e1'), 'uz')).toContain(
      'Apparat kalibrlash muddati',
    );
    expect(formatTelegramNotification(dto('reagent_shortfall', 's1'), 'ru')).toContain(
      'Недостаточно реактива',
    );
  });
});
