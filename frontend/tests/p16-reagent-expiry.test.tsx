import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { ReagentDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

/** P16 / TZ §3.2 — "muddati yaqin" filtri va belgisi (D-170). */

let api: MockAdapter;

const base: ReagentDto = {
  id: 'r1',
  companyId: 'c1',
  name: 'Etanol',
  casNumber: null,
  unit: 'l',
  quantity: 3,
  lowStockThreshold: 1,
  expiresAt: '2026-07-01',
  supplier: null,
  storageConditions: null,
  isHazardous: false,
  isLowStock: false,
  isExpired: false,
  isExpiringSoon: true,
  approvalStatus: 'approved',
  createdBy: null,
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

describe('P16: reaktiv muddati (UI)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('"Muddati yaqin" tab expiringWithinDays=30 yuboradi va belgi ko‘rinadi', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    const params: Record<string, unknown>[] = [];
    api.onGet('/reagents').reply((config) => {
      params.push((config.params ?? {}) as Record<string, unknown>);
      return [200, { data: [base], meta: { page: 1, limit: 20, total: 1 } }];
    });
    renderAt('/reagents');
    await waitFor(() => expect(screen.getByText('Etanol')).toBeInTheDocument());
    expect(screen.getAllByText('Muddati yaqin').length).toBeGreaterThan(1); // tab + belgi
    expect(params[0]).not.toHaveProperty('expiringWithinDays');

    await user.click(screen.getByRole('tab', { name: 'Muddati yaqin' }));
    await waitFor(() => expect(params.some((p) => p.expiringWithinDays === 30)).toBe(true));
  });

  it('muddati uzoq tasdiqlangan reaktiv — "Normal", "Muddati yaqin" belgisi yo‘q', async () => {
    loginAs('chemist');
    api.onGet('/reagents').reply(200, {
      data: [{ ...base, isExpiringSoon: false, expiresAt: '2028-01-01' }],
      meta: { page: 1, limit: 20, total: 1 },
    });
    renderAt('/reagents');
    await waitFor(() => expect(screen.getByText('Etanol')).toBeInTheDocument());
    expect(screen.getByText('Normal')).toBeInTheDocument();
    // Faqat tab nomi qoladi
    expect(screen.getAllByText('Muddati yaqin')).toHaveLength(1);
  });
});
