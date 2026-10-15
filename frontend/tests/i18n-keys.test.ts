import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import uz from '@/i18n/locales/uz.json';
import { NAV_ITEMS } from '@/config/navigation';
import { getTabsForRole } from '@/components/telegram/TelegramMobileShell';
import type { Role } from '@/types';

// Koddagi har bir statik t('...') kaliti uchala tilda bor (standart qiymatga tayanmaydi)
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const lookup = (dict: object, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      dict,
    );

const keys = new Set<string>();

// 1. Koddan statik topilgan barcha kalitlar
for (const file of walk(srcDir)) {
  for (const m of readFileSync(file, 'utf8').matchAll(
    /\bt\(\s*(['"])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\1/g,
  )) {
    keys.add(m[2]!);
  }
}

// 2. Navigatsiya elementlari kalitlari (desktop va mobil WebApp)
for (const item of NAV_ITEMS) {
  keys.add(item.labelKey);
}

const roles: Role[] = ['super_admin', 'admin', 'lab_head', 'chemist', 'kontrolyor', 'director'];
for (const role of roles) {
  const { tabs, moreItems } = getTabsForRole(role);
  for (const tab of tabs) {
    keys.add(tab.labelKey);
    keys.add(tab.shortKey);
  }
  for (const item of moreItems) {
    keys.add(item.labelKey);
  }
}

// Qat'iy talab: nav.audit va nav.more
keys.add('nav.audit');
keys.add('nav.auditShort');
keys.add('nav.moreShort');

// 3. Audit va faoliyat jurnali enum va filtrlari
const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'login_failed',
  'login_telegram',
  'telegram_link',
  'telegram_unlink',
  'logout',
  'session_revoked',
  'token_refresh_reuse',
  'status_change',
  'assign',
  'sign',
  'resolve',
  'complete',
  'record',
  'revoke',
  'disposal',
  'alert',
  'in',
  'out',
  'adjustment',
];

const AUDIT_RESOURCES = [
  'users',
  'companies',
  'sessions',
  'auth',
  'samples',
  'sample_tracking',
  'protocols',
  'substances',
  'reagents',
  'reagent_journal',
  'temperature',
  'temperature_sensors',
  'temperature_alerts',
  'stability',
  'stability_plans',
  'registry',
  'files',
  'audit_log',
];

for (const action of AUDIT_ACTIONS) {
  keys.add(`audit.actions.${action}`);
}

for (const res of AUDIT_RESOURCES) {
  keys.add(`audit.resources.${res}`);
}

keys.add('audit.filters.actionPlaceholder');
keys.add('audit.filters.resourcePlaceholder');
keys.add('activity.filters.actionPlaceholder');
keys.add('activity.filters.resourcePlaceholder');
keys.add('auth.logout');
keys.add('auth.logoutDesc');
keys.add('auth.logoutConfirmTitle');
keys.add('auth.logoutConfirmDesc');
keys.add('telegram.webapp.loggedOutTitle');
keys.add('telegram.webapp.loggedOutInstructions');
keys.add('telegram.webapp.reLogin');

describe('i18n kalitlari to‘liqligi', () => {
  it('kalitlar topildi', () => {
    expect(keys.size).toBeGreaterThan(320);
  });

  it.each([
    ['uz', uz],
    ['ru', ru],
    ['en', en],
  ] as const)('%s: koddagi barcha statik va dinamik kalitlar matn sifatida mavjud', (_lng, dict) => {
    const missing = [...keys].filter((k) => typeof lookup(dict, k) !== 'string');
    expect(missing).toEqual([]);
  });
});
