import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import type {
  AiStatusDto,
  CompanyDto,
  HistoryItemDto,
  NdDetailDto,
  NdExtractionDto,
  SampleDetailDto,
} from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P18: ND AI talablari (D-182), ND metadata (D-184), yagona tarix (D-189), kompaniya AI flag'i (D-179). */

let api: MockAdapter;

const status = (enabled: boolean): AiStatusDto => ({
  enabled,
  configured: true,
  companyEnabled: enabled,
  dailyLimit: 200,
  usedToday: 1,
  maxFileMb: 10,
});

const nd = (over: Partial<NdDetailDto> = {}): NdDetailDto => ({
  id: 'nd1',
  code: 'ND-42',
  name: 'Paratsetamol',
  version: '2024',
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  fileName: 'nd.pdf',
  fileSize: 1000,
  hasFile: true,
  requirementCount: 3,
  substanceName: 'Paratsetamol',
  series: 'S-01',
  docDate: '2026-02-01',
  chemistId: 'ch1',
  chemistName: 'Ali Valiyev',
  equipmentId: 'e1',
  equipmentName: 'HPLC Agilent',
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
      source: 'ai',
      note: null,
      sortOrder: 0,
      aiValue: {
        kind: 'reagent',
        methodName: 'Sulfated ash',
        equipmentCategory: null,
        reagentItemId: 'i1',
        reagentName: 'Sulfat kislota',
        quantity: 2,
        unit: 'ml',
        confidence: 'low',
      },
    },
    {
      id: 'r2',
      kind: 'equipment',
      methodName: null,
      equipmentCategory: 'Mufel pech',
      reagentItemId: null,
      reagentItemName: null,
      quantityPerAnalysis: null,
      unit: null,
      source: 'manual',
      note: null,
      sortOrder: 1,
      aiValue: {
        kind: 'equipment',
        methodName: null,
        equipmentCategory: 'Mufel',
        reagentItemId: null,
        reagentName: null,
        quantity: null,
        unit: null,
        confidence: 'high',
      },
    },
  ],
  ...over,
});

function mockNd(n: NdDetailDto, ai = true) {
  api.onGet('/nd/nd1').reply(200, { data: n });
  api.onGet('/nd/nd1/feasibility').reply(200, {
    data: {
      ndId: 'nd1',
      ndStatus: n.status,
      nAnalyses: 1,
      canRun: true,
      reasons: [],
      equipment: [],
      reagents: [],
    },
  });
  api.onGet('/history/nd/nd1').reply(200, { data: [] });
  api.onGet('/ai/status').reply(200, { data: status(ai) });
}

describe('P18: ND — AI talablari va metadata', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('metadata, AI belgilari (AI / Tekshiring / AI → tahrirlangan) ko‘rinadi', async () => {
    mockNd(nd());
    loginAs('chemist');
    renderAt('/nd/nd1');
    expect(await screen.findByText('Hujjat ma’lumotlari')).toBeInTheDocument();
    expect(screen.getByText('S-01')).toBeInTheDocument();
    expect(screen.getByText('Ali Valiyev')).toBeInTheDocument();
    expect(screen.getByText('HPLC Agilent')).toBeInTheDocument();
    expect(screen.getAllByText('AI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tekshiring').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI → tahrirlangan').length).toBeGreaterThan(0);
    // chemist ND yozolmaydi — AI tugmasi yo'q
    expect(screen.queryByRole('button', { name: 'Hujjatdan talablarni aniqlash' })).toBeNull();
  });

  it('lab_head: "Hujjatdan talablarni aniqlash" → xulosa va o‘tkazib yuborilganlar sababi', async () => {
    const user = userEvent.setup();
    mockNd(nd());
    const result: NdExtractionDto = {
      extractionId: 'ex-nd',
      status: 'ok',
      imageQuality: 'good',
      errorCode: null,
      createdIds: ['a', 'b'],
      skipped: [
        {
          kind: 'reagent',
          name: 'Xlorid kislota',
          quantity: '5',
          unit: 'ml',
          methodName: 'Identifikatsiya',
          reason: 'not_in_catalog',
          suggestions: [
            {
              id: 'i9',
              name: 'Xlorid kislota 36%',
              unitFamily: 'volume',
              score: 0.7,
              exact: false,
            },
          ],
        },
        {
          kind: 'reagent',
          name: 'Natriy',
          quantity: '3',
          unit: 'qop',
          methodName: null,
          reason: 'unknown_unit',
          suggestions: [],
        },
      ],
    };
    let body: unknown = null;
    api.onPost('/ai/extract/nd').reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: result }];
    });
    loginAs('lab_head');
    renderAt('/nd/nd1');
    await user.click(await screen.findByRole('button', { name: 'Hujjatdan talablarni aniqlash' }));
    expect(
      await screen.findByText('2 ta qoralama talab qo‘shildi — tekshirib tasdiqlang'),
    ).toBeInTheDocument();
    expect(body).toEqual({ ndId: 'nd1' });
    expect(
      screen.getByText(
        'Reaktiv katalogda topilmadi — avval katalogga qo‘shing yoki qo‘lda kiriting',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('O‘lchov birligi noma’lum')).toBeInTheDocument();
    expect(screen.getByText('Katalogdagi o‘xshash: Xlorid kislota 36%')).toBeInTheDocument();
    // ND qayta yuklanadi (refetch)
    await waitFor(() =>
      expect(api.history.get.filter((r) => r.url === '/nd/nd1').length).toBeGreaterThan(1),
    );
  });

  it('AI tugmasi: AI o‘chiq, fayl yo‘q yoki ND tasdiqlangan bo‘lsa ko‘rinmaydi', async () => {
    mockNd(nd({ hasFile: false, fileName: null }));
    loginAs('lab_head');
    renderAt('/nd/nd1');
    await screen.findByText('Hujjat ma’lumotlari');
    await waitFor(() => expect(api.history.get.some((r) => r.url === '/ai/status')).toBe(true));
    expect(screen.queryByRole('button', { name: 'Hujjatdan talablarni aniqlash' })).toBeNull();
  });

  it('409 ND_NOT_DRAFT — inline xabar', async () => {
    const user = userEvent.setup();
    mockNd(nd());
    api.onPost('/ai/extract/nd').reply(409, {
      error: { code: 'ND_NOT_DRAFT', message: 'x', requestId: 'r' },
    });
    loginAs('lab_head');
    renderAt('/nd/nd1');
    await user.click(await screen.findByRole('button', { name: 'Hujjatdan talablarni aniqlash' }));
    expect(
      await screen.findByText('Talablarni faqat qoralama ND uchun aniqlash mumkin'),
    ).toBeInTheDocument();
  });

  it('ND tahrirlash: metadata PUT /nd/:id ga yuboriladi', async () => {
    const user = userEvent.setup();
    mockNd(nd({ chemistId: null, chemistName: null }));
    api.onGet('/registry/chemists').reply(200, {
      data: [{ id: 'ch2', fullName: 'Olim Karimov', isActive: true }],
    });
    api.onGet('/equipment').reply(200, { data: [], meta: { page: 1, limit: 100, total: 0 } });
    let body: Record<string, unknown> | null = null;
    api.onPut('/nd/nd1').reply((c) => {
      body = JSON.parse(c.data as string) as Record<string, unknown>;
      return [200, { data: nd() }];
    });
    loginAs('lab_head');
    renderAt('/nd/nd1');
    await user.click(await screen.findByRole('button', { name: 'ND ni tahrirlash' }));
    const dialog = screen.getByRole('dialog');
    const series = within(dialog).getByLabelText('Seriya');
    await user.clear(series);
    await user.type(series, 'S-02');
    await selectOption(user, within(dialog).getByLabelText('Kimyogar'), 'ch2');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      code: 'ND-42',
      series: 'S-02',
      substanceName: 'Paratsetamol',
      docDate: '2026-02-01',
      chemistId: 'ch2',
      equipmentId: 'e1',
    });
  });
});

// ---------------------------------------------------------------- Yagona tarix

const sample = {
  id: 's1',
  companyId: 'c1',
  type: 'raw_material',
  status: 'in_progress',
  substanceId: null,
  substanceName: 'Amoksitsillin',
  serialNumber: 'SN-01',
  lotNumber: null,
  quantity: null,
  manufacturer: null,
  manufacturedAt: null,
  analysisStart: null,
  analysisEnd: null,
  notes: null,
  createdBy: 'u2',
  assignedTo: 'u9',
  assignedBy: 'u3',
  assignedAt: '2026-03-01T10:00:00.000Z',
  stopReason: null,
  stoppedAt: null,
  deletedAt: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
  tracking: [],
} as SampleDetailDto;

const history: HistoryItemDto[] = [
  {
    id: 'ai:1',
    type: 'ai_review',
    at: '2026-03-01T10:00:00.000Z',
    actorId: 'u2',
    actorName: 'Kontrolyor K.',
    data: {
      extractionId: 'ex-1',
      changed: [
        { field: 'serialNumber', aiValue: 'SN-0I', finalValue: 'SN-01', confidence: 'low' },
      ],
      accepted: ['substanceName', 'quantity'],
    },
  },
  {
    id: 'rej:1',
    type: 'protocol_rejected',
    at: '2026-03-03T10:00:00.000Z',
    actorId: 'u3',
    actorName: 'Mudir M.',
    data: { protocolId: 'p1', reason: 'Peak fayli yetishmaydi', protocolRole: 'standard' },
  },
  {
    id: 'sig:1',
    type: 'protocol_signed',
    at: '2026-03-04T10:00:00.000Z',
    actorId: 'u9',
    actorName: 'Kimyogar Q.',
    data: { protocolId: 'p1', action: 'submitted', role: 'chemist', protocolRole: 'standard' },
  },
];

describe('P18: yagona tarix (HistoryTimeline)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('namuna sahifasida AI diff (AI → yakuniy), qabul qilinganlar soni va rad etish sababi', async () => {
    api.onGet('/samples/s1').reply(200, { data: sample });
    api.onGet('/protocols/sample/s1').reply(200, { data: [] });
    api.onGet('/history/sample/s1').reply(200, { data: history });
    loginAs('lab_head');
    renderAt('/samples/s1');
    const list = await screen.findByRole('list', { name: 'Umumiy tarix' });
    expect(within(list).getByText('AI taklifi ko‘rib chiqildi')).toBeInTheDocument();
    expect(within(list).getByText('Seriya raqami:')).toBeInTheDocument();
    expect(within(list).getByText('SN-0I')).toBeInTheDocument();
    expect(within(list).getByText('SN-01')).toBeInTheDocument();
    expect(within(list).getByText('2 ta maydon o‘zgarishsiz qabul qilindi')).toBeInTheDocument();
    expect(within(list).getByText('Protokol rad etildi')).toBeInTheDocument();
    expect(within(list).getByText('Peak fayli yetishmaydi')).toBeInTheDocument();
    expect(within(list).getByText('Protokol yuborildi')).toBeInTheDocument();
  });

  it('reaktiv tarixi: kirim va AI diff (reaktiv yorliqlari)', async () => {
    const user = userEvent.setup();
    api.onGet('/reagents/r1').reply(200, {
      data: {
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
        lotNumber: 'LOT-9',
        manufacturer: 'Merck',
        manufacturedAt: '2026-01-05',
        arrivalDate: '2026-02-07',
        createdBy: null,
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    api.onGet(/\/reagents\/r1\/transactions/).reply(200, {
      data: [],
      meta: { page: 1, limit: 15, total: 0 },
    });
    api.onGet('/reagents/r1/documents').reply(200, { data: [] });
    api.onGet('/history/reagent/r1').reply(200, {
      data: [
        {
          id: 'tx1',
          type: 'reagent_transaction',
          at: '2026-02-07T10:00:00.000Z',
          actorId: 'u1',
          actorName: 'X',
          data: { kind: 'in', quantity: 5, before: 0, after: 5, note: null },
        },
        {
          id: 'ai2',
          type: 'ai_review',
          at: '2026-02-07T09:00:00.000Z',
          actorId: 'u1',
          actorName: 'X',
          data: {
            extractionId: 'e',
            changed: [
              { field: 'lotNumber', aiValue: 'L0T-9', finalValue: 'LOT-9', confidence: 'low' },
            ],
            accepted: [],
          },
        },
      ] satisfies HistoryItemDto[],
    });
    loginAs('lab_head');
    renderAt('/reagents/r1');
    // Lot maydonlari tafsilotda
    expect(await screen.findByText('LOT-9')).toBeInTheDocument();
    expect(screen.getByText('Merck')).toBeInTheDocument();
    expect(screen.getByText('05.01.2026')).toBeInTheDocument();
    expect(screen.getByText('07.02.2026')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Umumiy tarix/ }));
    const list = await screen.findByRole('list', { name: 'Umumiy tarix' });
    expect(within(list).getByText('Kirim')).toBeInTheDocument();
    expect(within(list).getByText('5 (qoldiq: 0 → 5)')).toBeInTheDocument();
    expect(within(list).getByText('Lot (seriya) raqami:')).toBeInTheDocument();
    expect(within(list).getByText('L0T-9')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- Kompaniya AI flag'i

const company: CompanyDto = {
  id: 'c1',
  name: 'Asror Farm Lab',
  slug: 'asror-farm',
  isActive: true,
  usersCount: 5,
  aiEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('P18: kompaniyalar — AI yordamchi flag‘i (super_admin)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uz');
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('switch → tasdiqlash → PATCH /companies/:id/ai { enabled: true }; /ai/status chaqirilmaydi', async () => {
    const user = userEvent.setup();
    api.onGet('/companies').reply(200, { data: [company], meta: { page: 1, limit: 10, total: 1 } });
    let body: unknown = null;
    api.onPatch('/companies/c1/ai').reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: { ...company, aiEnabled: true } }];
    });
    loginAs('super_admin');
    renderAt('/companies');
    const switches = await screen.findAllByRole('switch', {
      name: 'Asror Farm Lab uchun AI yordamchi',
    });
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    await user.click(switches[0]!);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('AI yordamchini yoqasizmi?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tasdiqlash' }));
    await waitFor(() => expect(body).toEqual({ enabled: true }));
    expect(api.history.get.some((r) => r.url === '/ai/status')).toBe(false);
  });
});
