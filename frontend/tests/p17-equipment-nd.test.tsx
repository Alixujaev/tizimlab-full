import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import { notificationLink } from '@/lib/notifications';
import { canRoleAccessPath, parseStartParam } from '@/lib/telegram';
import type { EquipmentDto, FeasibilityDto, NdDetailDto } from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P17 UI: apparatlar (D-175), ND va moslik (D-176), kontrolyor reaktiv kiritadi (D-178). */

let api: MockAdapter;

const eq = (over: Partial<EquipmentDto> = {}): EquipmentDto => ({
  id: 'e1',
  companyId: 'c1',
  name: 'Mufel pech SNOL',
  category: 'Mufel pech',
  model: 'SNOL 8.2',
  serialNumber: 'MP-01',
  location: 'Xona-3',
  status: 'active',
  calibrationDue: '2026-01-01',
  isCalibrationExpired: true,
  isCalibrationDueSoon: false,
  isUsable: false,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const nd = (over: Partial<NdDetailDto> = {}): NdDetailDto => ({
  id: 'nd1',
  code: 'ND-42',
  name: 'Paratsetamol',
  version: '2024',
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  fileName: null,
  fileSize: null,
  hasFile: false,
  requirementCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  requirements: [
    {
      id: 'r1',
      kind: 'reagent',
      methodName: 'Sulfated ash',
      equipmentCategory: null,
      reagentItemId: 'i1',
      reagentItemName: 'Sulfat kislota',
      quantityPerAnalysis: 2,
      unit: 'ml',
      source: 'manual',
      note: null,
      sortOrder: 0,
    },
  ],
  ...over,
});

const feasibility = (n: number): FeasibilityDto => ({
  ndId: 'nd1',
  ndStatus: 'draft',
  nAnalyses: n,
  canRun: false,
  reasons: [
    {
      type: 'reagent_insufficient',
      detail: 'x',
      data: {
        reagent: 'Sulfat kislota',
        required: 2 * n,
        available: 3,
        missing: 2 * n - 3,
        unit: 'ml',
      },
    },
    { type: 'equipment_missing', detail: 'x', data: { category: 'Mufel pech' } },
  ],
  equipment: [],
  reagents: [
    {
      reagentItemId: 'i1',
      reagentName: 'Sulfat kislota',
      unit: 'ml',
      required: 2 * n,
      available: 3,
      ok: false,
    },
  ],
});

describe('P17: apparatlar sahifasi', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    api.onGet('/equipment/categories').reply(200, { data: ['Mufel pech'] });
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('ro‘yxat: holat va kalibrlash belgilari; lab_head apparat qo‘shadi (POST)', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    api.onGet('/equipment').reply(200, { data: [eq()], meta: { page: 1, limit: 20, total: 1 } });
    let body: unknown = null;
    api.onPost('/equipment').reply((c) => {
      body = JSON.parse(c.data as string);
      return [201, { data: eq({ id: 'e2' }) }];
    });
    renderAt('/equipment');
    await waitFor(() => expect(screen.getByText('Mufel pech SNOL')).toBeInTheDocument());
    expect(screen.getAllByText('Kalibrlash o‘tgan').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Apparat qo‘shish' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Nomi/), 'HPLC Agilent');
    await user.type(within(dialog).getByLabelText(/^Kategoriya/), 'HPLC');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() =>
      expect(body).toMatchObject({ name: 'HPLC Agilent', category: 'HPLC', status: 'active' }),
    );
  });

  it('kontrolyor: qo‘shish tugmasi yo‘q; /equipment/:id faqat ko‘rish rejimida ochiladi', async () => {
    loginAs('kontrolyor');
    api.onGet('/equipment').reply(200, { data: [eq()], meta: { page: 1, limit: 20, total: 1 } });
    api.onGet('/equipment/e1').reply(200, { data: eq() });
    renderAt('/equipment/e1');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Nomi/)).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Saqlash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apparat qo‘shish' })).not.toBeInTheDocument();
  });

  it('"Kalibrlash 30 kun ichida" filtri calibrationDueWithinDays=30 yuboradi', async () => {
    const user = userEvent.setup();
    loginAs('chemist');
    const seen: Record<string, unknown>[] = [];
    api.onGet('/equipment').reply((c) => {
      seen.push((c.params ?? {}) as Record<string, unknown>);
      return [200, { data: [], meta: { page: 1, limit: 20, total: 0 } }];
    });
    renderAt('/equipment');
    await user.click(await screen.findByRole('tab', { name: 'Kalibrlash 30 kun ichida' }));
    await waitFor(() => expect(seen.some((p) => p.calibrationDueWithinDays === 30)).toBe(true));
  });
});

describe('P17: ND sahifasi', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    api.onGet('/equipment/categories').reply(200, { data: ['Mufel pech'] });
    api.onGet('/reagents/items').reply(200, {
      data: [
        { id: 'i1', name: 'Sulfat kislota', casNumber: null, unitFamily: 'volume', usableLots: 1 },
      ],
    });
    api.onGet('/nd/nd1/feasibility').reply((c) => [200, { data: feasibility(Number(c.params.n)) }]);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('draft ND: talablar jadvali, reaktiv talabi qo‘shish (POST), moslik sabablari UI tilida', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    api.onGet('/nd/nd1').reply(200, { data: nd() });
    let posted: unknown = null;
    api.onPost('/nd/nd1/requirements').reply((c) => {
      posted = JSON.parse(c.data as string);
      return [201, { data: nd() }];
    });
    renderAt('/nd/nd1');
    expect(await screen.findByText('Sulfat kislota — 2 ml / tahlil')).toBeInTheDocument();
    expect(await screen.findByText('Tahlilni bajarish mumkin emas')).toBeInTheDocument();
    expect(
      screen.getByText('"Sulfat kislota" yetarli emas: kerak 2 ml, mavjud 3 ml, yetishmaydi -1 ml'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('"Mufel pech" turidagi apparat laboratoriyada yo‘q'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Talab qo‘shish' }));
    const dialog = screen.getByRole('dialog');
    await selectOption(user, within(dialog).getByLabelText(/^Reaktiv$/), 'i1');
    await user.type(within(dialog).getByLabelText(/Bir tahlil uchun miqdor/), '2');
    await user.type(within(dialog).getByLabelText(/^Metodika/), 'Sulfated ash');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() =>
      expect(posted).toEqual({
        kind: 'reagent',
        reagentItemId: 'i1',
        quantityPerAnalysis: 2,
        unit: 'ml',
        methodName: 'Sulfated ash',
      }),
    );
  });

  it('tahlillar soni o‘zgarsa moslik qayta so‘raladi (n=3)', async () => {
    const user = userEvent.setup();
    loginAs('chemist');
    api.onGet('/nd/nd1').reply(200, { data: nd({ status: 'approved' }) });
    renderAt('/nd/nd1');
    const input = await screen.findByLabelText('Tahlillar soni');
    await user.clear(input);
    await user.type(input, '3');
    await waitFor(() =>
      expect(api.history.get.some((r) => r.url === '/nd/nd1/feasibility' && r.params.n === 3)).toBe(
        true,
      ),
    );
  });

  it('chemist: tasdiqlash/talab qo‘shish tugmalari yo‘q; approved ND da lab_head uchun ham tahrirlash yo‘q', async () => {
    loginAs('chemist');
    api.onGet('/nd/nd1').reply(200, { data: nd() });
    renderAt('/nd/nd1');
    await screen.findByText('Sulfat kislota — 2 ml / tahlil');
    expect(screen.queryByRole('button', { name: 'Tasdiqlash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talab qo‘shish' })).not.toBeInTheDocument();
  });

  it('lab_head approved ND: "Qayta ko‘rib chiqish" mavjud, "Talab qo‘shish" yo‘q', async () => {
    loginAs('lab_head');
    api.onGet('/nd/nd1').reply(200, { data: nd({ status: 'approved' }) });
    renderAt('/nd/nd1');
    expect(await screen.findByRole('button', { name: 'Qayta ko‘rib chiqish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talab qo‘shish' })).not.toBeInTheDocument();
  });
});

describe('P17: kontrolyor reaktiv kiritadi, havolalar', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('D-178: kontrolyor "Reaktiv qo‘shish" tugmasini ko‘radi, lekin tahrirlash/o‘chirish yo‘q', async () => {
    loginAs('kontrolyor');
    api.onGet('/reagents').reply(200, {
      data: [
        {
          id: 'r1',
          companyId: 'c1',
          name: 'Etanol',
          casNumber: null,
          unit: 'l',
          quantity: 1,
          lowStockThreshold: 0,
          expiresAt: null,
          supplier: null,
          storageConditions: null,
          isHazardous: false,
          isLowStock: false,
          isExpired: false,
          approvalStatus: 'approved',
          createdBy: null,
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    renderAt('/reagents');
    await screen.findByText('Etanol');
    const uz = (await import('@/i18n/locales/uz.json')).default as { reagents: { create: string } };
    expect(screen.getByRole('button', { name: uz.reagents.create })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tahrirlash' })).not.toBeInTheDocument();
  });

  it('deep link va xabarnoma havolalari', () => {
    expect(parseStartParam('equipment_e1')).toEqual({ path: '/equipment/e1', id: 'e1' });
    expect(canRoleAccessPath('chemist', '/equipment/e1')).toBe(true);
    expect(canRoleAccessPath('kontrolyor', '/nd/x')).toBe(true);
    expect(canRoleAccessPath('super_admin', '/nd')).toBe(false);
    expect(notificationLink({ type: 'equipment_calibration_due', referenceId: 'e1' })).toBe(
      '/equipment/e1',
    );
    expect(notificationLink({ type: 'reagent_shortfall', referenceId: 's1' })).toBe('/samples/s1');
  });
});
