import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { ReagentDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';
import { telegramStub } from './telegramStub';

/**
 * P16 — yangi UI Telegram WebApp mobil shell'i ichida (D-166): reaktiv tasdiqlash paneli,
 * "Muddati yaqin" filtri va protokol xonasi tanlovi mobil ko'rinishda ishlaydi.
 */

let api: MockAdapter;

const reagent: ReagentDto = {
  id: 'reag-m',
  companyId: 'c1',
  name: 'Sulfat kislota',
  casNumber: null,
  unit: 'ml',
  quantity: 100,
  lowStockThreshold: 10,
  expiresAt: '2026-12-20',
  supplier: null,
  storageConditions: null,
  isHazardous: false,
  isLowStock: false,
  isExpired: false,
  isExpiringSoon: true,
  approvalStatus: 'pending',
  createdBy: 'u9',
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

describe('P16: Telegram WebApp mobil shell', () => {
  beforeEach(() => {
    window.Telegram = { WebApp: telegramStub() };
    api = new MockAdapter(apiClient);
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 0 } });
    api.onGet(/\/notifications/).reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
  });
  afterEach(() => {
    delete window.Telegram;
    api.restore();
    resetAuth();
  });

  it('kimyogar reaktivni Telegram ichida tasdiqlay oladi (panel va tugmalar mobil shell’da)', async () => {
    loginAs('chemist');
    api.onGet('/reagents/reag-m').reply(200, { data: reagent });
    api
      .onGet('/reagents/reag-m/transactions')
      .reply(200, { data: [], meta: { page: 1, limit: 15, total: 0 } });
    api.onGet('/reagents/reag-m/documents').reply(200, { data: [] });
    renderAt('/reagents/reag-m');
    expect(
      await screen.findByText('Reaktiv tasdiqlashni kutmoqda', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tasdiqlash' })).toBeInTheDocument();
    // Mobil shell: pastki navigatsiya mavjud
    await waitFor(() => expect(screen.getByRole('button', { name: /Yana/i })).toBeInTheDocument());
  });

  it('reaktivlar ro‘yxati: "Muddati yaqin" va "Tasdiq kutilmoqda" belgilari mobil ko‘rinishda', async () => {
    loginAs('lab_head');
    api.onGet('/reagents').reply(200, { data: [reagent], meta: { page: 1, limit: 20, total: 1 } });
    renderAt('/reagents');
    expect(await screen.findByText('Sulfat kislota', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getAllByText('Muddati yaqin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tasdiq kutilmoqda').length).toBeGreaterThan(0);
  });
});
