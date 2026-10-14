import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../src/config/permissions.js';
import {
  analyticsCacheKey,
  cached,
  clearAnalyticsCache,
} from '../src/modules/analytics/analytics.cache.js';
import { hours, percent } from '../src/modules/analytics/analytics.metrics.js';
import {
  bucketKeys,
  fillBuckets,
  localDate,
  resolvePeriod,
} from '../src/modules/analytics/analytics.period.js';
import { periodQuerySchema } from '../src/modules/analytics/analytics.schemas.js';
import { canView } from '../src/modules/analytics/analytics.scope.js';
import type { Viewer } from '../src/modules/analytics/analytics.types.js';

describe('analytics: davr (D-161)', () => {
  const now = new Date('2025-03-31T20:00:00Z'); // Toshkentda 1-aprel 01:00

  it('Toshkent sanasi UTC+5', () => {
    expect(localDate(now)).toBe('2025-04-01');
    expect(localDate(new Date('2025-03-31T18:59:59Z'))).toBe('2025-03-31');
  });

  it('7d preset: bugun bilan 7 kun, oldingi davr teng uzunlikda', () => {
    const p = resolvePeriod(periodQuerySchema.parse({ period: '7d' }), now);
    expect(p).toMatchObject({ from: '2025-03-26', to: '2025-04-01', days: 7, bucket: 'day' });
    expect(p.start.toISOString()).toBe('2025-03-25T19:00:00.000Z');
    expect(p.end.toISOString()).toBe('2025-04-01T19:00:00.000Z');
    expect(p.prevEnd.getTime()).toBe(p.start.getTime());
    expect(p.start.getTime() - p.prevStart.getTime()).toBe(7 * 86_400_000);
  });

  it('default — 30d; 90d — haftalik bucket', () => {
    expect(resolvePeriod(periodQuerySchema.parse({}), now).days).toBe(30);
    const p = resolvePeriod(periodQuerySchema.parse({ period: '90d' }), now);
    expect(p.bucket).toBe('week');
    // haftalar dushanbadan boshlanadi
    for (const k of bucketKeys(p)) expect(new Date(`${k}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it('custom: kelajak sanasi — ValidationError', () => {
    const q = periodQuerySchema.parse({ period: 'custom', from: '2025-03-01', to: '2025-04-02' });
    expect(() => resolvePeriod(q, now)).toThrow(/So'rov/);
  });

  it('366 kun ruxsat, 367 — yo‘q', () => {
    expect(
      periodQuerySchema.safeParse({ period: 'custom', from: '2024-01-01', to: '2024-12-31' })
        .success,
    ).toBe(true);
    expect(
      periodQuerySchema.safeParse({ period: 'custom', from: '2024-01-01', to: '2025-01-01' })
        .success,
    ).toBe(false);
  });

  it('fillBuckets: bo‘sh kunlar 0, davrdan tashqarisi tashlanadi', () => {
    const p = resolvePeriod(
      periodQuerySchema.parse({ period: 'custom', from: '2025-03-01', to: '2025-03-03' }),
      now,
    );
    expect(
      fillBuckets(p, [
        { day: '2025-03-02', value: 2 },
        { day: '2025-02-28', value: 9 },
      ]),
    ).toEqual([
      { date: '2025-03-01', value: 0 },
      { date: '2025-03-02', value: 2 },
      { date: '2025-03-03', value: 0 },
    ]);
  });
});

describe('analytics: formulalar yordamchilari', () => {
  it('percent: maxraj 0 → null, 1 xona', () => {
    expect(percent(0, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 2)).toBe(100);
  });
  it('hours: null saqlanadi', () => {
    expect(hours(null)).toBeNull();
    expect(hours('50.4999')).toBe(50.5);
  });
});

describe('analytics: ruxsatlar va doira (D-159, D-160)', () => {
  it('rol katalogi', () => {
    expect(ROLE_PERMISSIONS.admin.filter((p) => p.startsWith('analytics:'))).toEqual([]);
    expect(ROLE_PERMISSIONS.super_admin).toEqual([]);
    expect(ROLE_PERMISSIONS.chemist).toContain('analytics:view');
    expect(ROLE_PERMISSIONS.chemist).not.toContain('analytics:team');
    expect(ROLE_PERMISSIONS.lab_head).toEqual(expect.arrayContaining(['analytics:team']));
    expect(ROLE_PERMISSIONS.lab_head).not.toContain('analytics:company');
    expect(ROLE_PERMISSIONS.director).toEqual(
      expect.arrayContaining(['analytics:view', 'analytics:team', 'analytics:company']),
    );
  });

  const v = (scope: Viewer['scope']): Viewer => ({
    userId: 'me',
    companyId: 'c',
    role: 'chemist',
    scope,
  });
  it('canView: o‘zi har doim; team — chemist/kontrolyor; company — + lab_head', () => {
    expect(canView(v('self'), { id: 'me', role: 'chemist' })).toBe(true);
    expect(canView(v('self'), { id: 'x', role: 'chemist' })).toBe(false);
    expect(canView(v('team'), { id: 'x', role: 'kontrolyor' })).toBe(true);
    expect(canView(v('team'), { id: 'x', role: 'lab_head' })).toBe(false);
    expect(canView(v('company'), { id: 'x', role: 'lab_head' })).toBe(true);
    expect(canView(v('company'), { id: 'x', role: 'director' })).toBe(false);
    expect(canView(v('company'), { id: 'x', role: 'admin' })).toBe(false);
  });
});

describe('analytics: kesh (D-164)', () => {
  it('kalit tenant va ko‘ruvchini o‘z ichiga oladi', async () => {
    clearAnalyticsCache();
    const k1 = analyticsCacheKey('A', 'u1', 'overview', ['x']);
    const k2 = analyticsCacheKey('B', 'u1', 'overview', ['x']);
    expect(k1).not.toBe(k2);
    expect(await cached(k1, async () => 1)).toBe(1);
    expect(await cached(k1, async () => 2)).toBe(1);
    expect(await cached(k2, async () => 3)).toBe(3);
  });

  it('xato natija keshlanmaydi', async () => {
    clearAnalyticsCache();
    const k = analyticsCacheKey('A', 'u', 'e', []);
    await expect(cached(k, async () => Promise.reject(new Error('x')))).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(await cached(k, async () => 5)).toBe(5);
  });
});
