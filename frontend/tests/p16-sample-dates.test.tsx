import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { SampleDetailDto, SampleDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

/** P16 / TZ §3.1 — namuna formasida, ro'yxatida va detalida kelgan sana / yaroqlilik muddati (D-168). */

let api: MockAdapter;

const sample: SampleDto = {
  id: 'sample-p16',
  companyId: 'c1',
  type: 'raw_material',
  status: 'pending_assignment',
  substanceId: null,
  substanceName: 'Ibuprofen',
  serialNumber: 'SN-16',
  lotNumber: 'LOT-16',
  quantity: '5 kg',
  manufacturer: 'Zavod',
  manufacturedAt: '2026-01-01',
  analysisStart: null,
  analysisEnd: '2026-02-15',
  arrivalDate: '2026-02-01',
  expiryDate: '2028-01-31',
  notes: null,
  createdBy: 'u1',
  assignedTo: null,
  assignedBy: null,
  assignedAt: null,
  stopReason: null,
  stoppedAt: null,
  deletedAt: null,
  createdAt: '2026-02-01T08:00:00.000Z',
  updatedAt: '2026-02-01T08:00:00.000Z',
};

const detail: SampleDetailDto = { ...sample, tracking: [] };

describe('P16: namuna sanalari (UI)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    api.onGet('/substances').reply(200, { data: [], meta: { page: 1, limit: 100, total: 0 } });
    api.onGet('/samples').reply(200, { data: [sample], meta: { page: 1, limit: 20, total: 1 } });
    api.onGet('/samples/sample-p16').reply(200, { data: detail });
    api.onGet(/\/protocols\/sample\//).reply(200, { data: [] });
  });

  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('ro‘yxatda "Yaroqlilik muddati" ustuni DD.MM.YYYY ko‘rinishida', async () => {
    loginAs('lab_head');
    renderAt('/samples');
    await waitFor(() => expect(screen.getByText('Ibuprofen')).toBeInTheDocument());
    expect(screen.getAllByText('Yaroqlilik muddati').length).toBeGreaterThan(0);
    expect(screen.getAllByText('31.01.2028').length).toBeGreaterThan(0);
  });

  it('detal sahifasida kelgan sana va yaroqlilik muddati ko‘rinadi', async () => {
    loginAs('lab_head');
    renderAt('/samples/sample-p16');
    await waitFor(() => expect(screen.getByText('Kelgan sana')).toBeInTheDocument());
    expect(screen.getByText('01.02.2026')).toBeInTheDocument();
    expect(screen.getByText('31.01.2028')).toBeInTheDocument();
  });

  it('kontrolyor formasida yangi sanalar to‘ldiriladi va payload’da ISO ko‘rinishida ketadi', async () => {
    const user = userEvent.setup();
    loginAs('kontrolyor');
    let posted: Record<string, unknown> | null = null;
    api.onPost('/samples').reply((config) => {
      posted = JSON.parse(config.data as string) as Record<string, unknown>;
      return [201, { data: { ...sample, id: 'new' } }];
    });

    renderAt('/samples');
    await waitFor(() => expect(screen.getByText('Ibuprofen')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Yangi namuna/i }));
    const dialog = screen.getByRole('dialog');

    await user.type(within(dialog).getByLabelText(/^Modda nomi/i), 'Aspirin');
    await user.type(within(dialog).getByLabelText(/^Kelgan sana/i), '03.02.2026');
    await user.type(within(dialog).getByLabelText(/^Yaroqlilik muddati/i), '30.06.2027');
    await user.click(within(dialog).getByRole('button', { name: /Saqlash/i }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      substanceName: 'Aspirin',
      arrivalDate: '2026-02-03',
      expiryDate: '2027-06-30',
    });
  });

  it('sanalar bo‘sh qolsa null yuboriladi (ixtiyoriy maydonlar)', async () => {
    const user = userEvent.setup();
    loginAs('kontrolyor');
    let posted: Record<string, unknown> | null = null;
    api.onPost('/samples').reply((config) => {
      posted = JSON.parse(config.data as string) as Record<string, unknown>;
      return [201, { data: { ...sample, id: 'new2' } }];
    });
    renderAt('/samples');
    await waitFor(() => expect(screen.getByText('Ibuprofen')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Yangi namuna/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Modda nomi/i), 'Aspirin');
    await user.click(within(dialog).getByRole('button', { name: /Saqlash/i }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ arrivalDate: null, expiryDate: null });
  });
});
