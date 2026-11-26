import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { notificationLink, notificationTitle } from '@/lib/notifications';
import { canRoleAccessPath, parseStartParam } from '@/lib/telegram';

/** P16 / TZ §4 — Telegram xabarnomasidagi "Ko'rish" deep link'i va yangi turlar (D-170, D-171). */

describe('P16: Telegram deep link va xabarnoma turlari', () => {
  it('reagent_<id> → /reagents/<id>; registry/r_ prefikslari buzilmaydi', () => {
    expect(parseStartParam('reagent_abc-1')).toEqual({ path: '/reagents/abc-1', id: 'abc-1' });
    expect(parseStartParam('registry_9')).toEqual({ path: '/registry/9', id: '9' });
    expect(parseStartParam('r_9')).toEqual({ path: '/registry/9', id: '9' });
  });

  it('reaktiv sahifasi barcha kompaniya rollariga ochiq, super_admin ga yopiq', () => {
    for (const role of ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin']) {
      expect(canRoleAccessPath(role, '/reagents/abc')).toBe(true);
    }
    expect(canRoleAccessPath('super_admin', '/reagents/abc')).toBe(false);
  });

  it('sample_created sarlavhasi uch tilda va namuna sahifasiga havola', async () => {
    const n = { type: 'sample_created' as const, title: 'x', referenceId: 's1' };
    await i18n.changeLanguage('uz');
    expect(notificationTitle(i18n.t, n)).toBe('Yangi namuna biriktirishni kutmoqda');
    await i18n.changeLanguage('ru');
    expect(notificationTitle(i18n.t, n)).toBe('Новый образец ожидает назначения');
    await i18n.changeLanguage('uz');
    expect(notificationLink(n)).toBe('/samples/s1');
  });
});
