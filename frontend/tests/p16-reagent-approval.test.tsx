import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import { notificationLink } from '@/lib/notifications';
import type { ReagentDto, Role } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

/** P16 / TZ §3.2 — reaktiv tasdiqlash UI (D-169). Test foydalanuvchisi id = 'u1'. */

let api: MockAdapter;

const pending: ReagentDto = {
  id: 'reag-p',
  companyId: 'c1',
  name: 'Sulfat kislota',
  casNumber: null,
  unit: 'ml',
  quantity: 100,
  lowStockThreshold: 10,
  expiresAt: '2027-12-31',
  supplier: null,
  storageConditions: null,
  isHazardous: false,
  isLowStock: false,
  isExpired: false,
  approvalStatus: 'pending',
  createdBy: 'u9',
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

function mockDetail(reagent: ReagentDto) {
  api.onGet(`/reagents/${reagent.id}`).reply(200, { data: reagent });
  api
    .onGet(`/reagents/${reagent.id}/transactions`)
    .reply(200, { data: [], meta: { page: 1, limit: 15, total: 0 } });
  api.onGet(`/reagents/${reagent.id}/documents`).reply(200, { data: [] });
}

describe('P16: reaktiv tasdiqlash (UI)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it.each<Role>(['chemist', 'lab_head'])(
    '%s (kirituvchi emas) "Tasdiqlash" tugmasini ko‘radi va POST /approve yuboradi',
    async (role) => {
      const user = userEvent.setup();
      loginAs(role);
      mockDetail(pending);
      let approved = false;
      api.onPost('/reagents/reag-p/approve').reply(() => {
        approved = true;
        return [200, { data: { ...pending, approvalStatus: 'approved' } }];
      });
      renderAt('/reagents/reag-p');
      await waitFor(() =>
        expect(screen.getByText('Reaktiv tasdiqlashni kutmoqda')).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
      await waitFor(() => expect(approved).toBe(true));
    },
  );

  it.each<Role>(['kontrolyor', 'director', 'admin'])(
    '%s holatni ko‘radi, lekin tasdiqlash tugmalari yo‘q',
    async (role) => {
      loginAs(role);
      mockDetail(pending);
      renderAt('/reagents/reag-p');
      await waitFor(() =>
        expect(screen.getByText('Reaktiv tasdiqlashni kutmoqda')).toBeInTheDocument(),
      );
      expect(screen.queryByRole('button', { name: 'Tasdiqlash' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rad etish' })).not.toBeInTheDocument();
    },
  );

  it('kiritgan lab_head o‘z reaktivini tasdiqlay olmaydi (tugma ko‘rinmaydi)', async () => {
    loginAs('lab_head');
    mockDetail({ ...pending, createdBy: 'u1' });
    renderAt('/reagents/reag-p');
    await waitFor(() =>
      expect(screen.getByText('Reaktiv tasdiqlashni kutmoqda')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Tasdiqlash' })).not.toBeInTheDocument();
  });

  it('rad etish: sabab 5 belgidan kam — xato, to‘g‘ri sabab — POST /reject', async () => {
    const user = userEvent.setup();
    loginAs('chemist');
    mockDetail(pending);
    let body: unknown = null;
    api.onPost('/reagents/reag-p/reject').reply((config) => {
      body = JSON.parse(config.data as string);
      return [
        200,
        { data: { ...pending, approvalStatus: 'rejected', rejectionReason: 'Mos emas!' } },
      ];
    });
    renderAt('/reagents/reag-p');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rad etish' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Rad etish' }));
    const dialog = screen.getByRole('dialog');
    const reason = within(dialog).getByLabelText(/Rad etish sababi/);
    await user.type(reason, 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Rad etish' }));
    expect(
      within(dialog).getByText('Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi shart'),
    ).toBeInTheDocument();
    expect(body).toBeNull();

    await user.type(reason, 'de mos emas');
    await user.click(within(dialog).getByRole('button', { name: 'Rad etish' }));
    await waitFor(() => expect(body).toEqual({ reason: 'abcde mos emas' }));
  });

  it('rad etilgan reaktivda sabab ko‘rsatiladi', async () => {
    loginAs('lab_head');
    mockDetail({ ...pending, approvalStatus: 'rejected', rejectionReason: 'Sertifikat mos emas' });
    renderAt('/reagents/reag-p');
    await waitFor(() => expect(screen.getByText('Reaktiv rad etilgan')).toBeInTheDocument());
    expect(screen.getByText('Sertifikat mos emas')).toBeInTheDocument();
  });

  it('tasdiqlanmagan reaktivda sarf (out) bloklanadi: ogohlantirish va Saqlash o‘chiq', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    mockDetail(pending);
    renderAt('/reagents/reag-p');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Yangi tranzaksiya|tranzaksiya/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /Yangi tranzaksiya|tranzaksiya/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Reaktiv hali tasdiqlanmagan/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  });

  it('ro‘yxatda "Tasdiq kutilmoqda" belgisi va filtr approvalStatus=pending yuboradi', async () => {
    const user = userEvent.setup();
    loginAs('chemist');
    const seen: unknown[] = [];
    api.onGet('/reagents').reply((config) => {
      seen.push(config.params);
      return [200, { data: [pending], meta: { page: 1, limit: 20, total: 1 } }];
    });
    renderAt('/reagents');
    await waitFor(() => expect(screen.getByText('Sulfat kislota')).toBeInTheDocument());
    expect(screen.getAllByText('Tasdiq kutilmoqda').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: 'Tasdiq kutayotganlar' }));
    await waitFor(() =>
      expect(
        seen.some((p) => (p as { approvalStatus?: string }).approvalStatus === 'pending'),
      ).toBe(true),
    );
  });

  it('reaktiv xabarnomalari reaktiv sahifasiga olib boradi', () => {
    expect(notificationLink({ type: 'reagent_pending_approval', referenceId: 'r1' })).toBe(
      '/reagents/r1',
    );
    expect(notificationLink({ type: 'reagent_expiring', referenceId: 'r1' })).toBe('/reagents/r1');
    expect(notificationLink({ type: 'low_stock', referenceId: 'r1' })).toBe('/reagents/r1');
    expect(notificationLink({ type: 'sample_assigned', referenceId: 's1' })).toBe('/samples/s1');
    expect(notificationLink({ type: 'temperature_alert', referenceId: 't1' })).toBeNull();
  });
});
