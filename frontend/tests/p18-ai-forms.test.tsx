import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { AiExtractionDto, AiStatusDto, ReagentDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

/** P18 (D-179..D-183): AI "Hujjatdan to'ldirish" — namuna va reaktiv formalari, reaktiv lot maydonlari. */

let api: MockAdapter;

const status = (enabled: boolean): AiStatusDto => ({
  enabled,
  configured: enabled,
  companyEnabled: enabled,
  dailyLimit: 200,
  usedToday: 0,
  maxFileMb: 10,
});

const empty = { value: null, confidence: null };

function sampleExtraction(over: Partial<AiExtractionDto> = {}): AiExtractionDto {
  return {
    extractionId: 'ex-1',
    kind: 'sample',
    status: 'ok',
    imageQuality: 'good',
    errorCode: null,
    fields: {
      substanceName: { value: 'Paratsetamol', confidence: 'high' },
      serialNumber: { value: 'SN-77', confidence: 'low' },
      manufacturer: empty,
      manufacturedAt: { value: '2026-01-10', confidence: 'high' },
      expiryDate: empty,
      quantity: { value: '25 kg', confidence: 'medium' },
      arrivalDate: empty,
      analysisEnd: empty,
    },
    catalogSuggestions: [],
    ...over,
  };
}

const png = () => new File(['x'], 'etiketka.png', { type: 'image/png' });

function mockSamples() {
  api.onGet('/substances').reply(200, { data: [], meta: { page: 1, limit: 100, total: 0 } });
  api.onGet('/samples').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
}

async function openSampleForm(user: ReturnType<typeof userEvent.setup>) {
  renderAt('/samples');
  await user.click(await screen.findByRole('button', { name: /Yangi namuna/i }));
  return screen.getByRole('dialog');
}

const fileInput = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('input[type="file"]')!;

describe('P18: namuna formasi — AI to‘ldirish', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    mockSamples();
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('AI o‘chiq (enabled=false) — "Hujjatdan to‘ldirish" ko‘rinmaydi', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(false) });
    loginAs('kontrolyor');
    const dialog = await openSampleForm(user);
    await waitFor(() => expect(api.history.get.some((r) => r.url === '/ai/status')).toBe(true));
    expect(within(dialog).queryByRole('button', { name: 'Hujjatdan to‘ldirish' })).toBeNull();
  });

  it('AI yoqilgan — tugma bor; maydonlar to‘ldiriladi, AI/“Tekshiring” belgilari, saqlashda ai.extractionId', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(true) });
    api.onPost('/ai/extract/sample').reply(200, { data: sampleExtraction() });
    let posted: Record<string, unknown> | null = null;
    api.onPost('/samples').reply((c) => {
      posted = JSON.parse(c.data as string) as Record<string, unknown>;
      return [201, { data: { id: 'new' } }];
    });
    loginAs('kontrolyor');
    const dialog = await openSampleForm(user);
    expect(
      await within(dialog).findByRole('button', { name: 'Hujjatdan to‘ldirish' }),
    ).toBeInTheDocument();

    await user.upload(fileInput(dialog), png());

    expect(await within(dialog).findByText(/AI 4 ta maydonni to‘ldirdi/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Modda nomi/)).toHaveValue('Paratsetamol');
    expect(within(dialog).getByLabelText(/^Seriya raqami/)).toHaveValue('SN-77');
    expect(within(dialog).getByLabelText(/^Miqdori/)).toHaveValue('25 kg');
    expect(within(dialog).getByLabelText(/^Ishlab chiqarilgan sana/)).toHaveValue('10.01.2026');
    // 4 ta maydon AI belgisi bilan; past (SN) va o'rta (miqdor) ishonch — "Tekshiring"
    expect(within(dialog).getAllByText('AI')).toHaveLength(4);
    expect(within(dialog).getAllByText('Tekshiring')).toHaveLength(2);
    // Null qiymatli maydon bo'sh qoladi
    expect(within(dialog).getByLabelText(/^Ishlab chiqaruvchi/)).toHaveValue('');
    // Hech narsa saqlanmagan — faqat Saqlash bosilganda
    expect(api.history.post.some((r) => r.url === '/samples')).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      substanceName: 'Paratsetamol',
      serialNumber: 'SN-77',
      quantity: '25 kg',
      manufacturedAt: '2026-01-10',
      ai: { extractionId: 'ex-1' },
    });
  });

  it('foydalanuvchi yozgan maydon ustidan yozilmaydi', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(true) });
    api.onPost('/ai/extract/sample').reply(200, { data: sampleExtraction() });
    loginAs('kontrolyor');
    const dialog = await openSampleForm(user);
    await within(dialog).findByRole('button', { name: 'Hujjatdan to‘ldirish' });
    await user.type(within(dialog).getByLabelText(/^Modda nomi/), 'Ibuprofen');
    await user.upload(fileInput(dialog), png());
    expect(await within(dialog).findByText(/AI 3 ta maydonni to‘ldirdi/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Modda nomi/)).toHaveValue('Ibuprofen');
  });

  it('past sifat — aniq xabar, maydonlar bo‘sh qoladi, ai yuborilmaydi', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(true) });
    api.onPost('/ai/extract/sample').reply(200, {
      data: sampleExtraction({
        imageQuality: 'poor',
        errorCode: 'AI_POOR_QUALITY',
        fields: {
          substanceName: empty,
          serialNumber: empty,
          manufacturer: empty,
          manufacturedAt: empty,
          expiryDate: empty,
          quantity: empty,
          arrivalDate: empty,
          analysisEnd: empty,
        },
      }),
    });
    let posted: Record<string, unknown> | null = null;
    api.onPost('/samples').reply((c) => {
      posted = JSON.parse(c.data as string) as Record<string, unknown>;
      return [201, { data: { id: 'new' } }];
    });
    loginAs('kontrolyor');
    const dialog = await openSampleForm(user);
    await within(dialog).findByRole('button', { name: 'Hujjatdan to‘ldirish' });
    await user.upload(fileInput(dialog), png());
    expect(
      await within(dialog).findByText(
        "Rasm sifati past — qayta suratga oling yoki qo'lda to'ldiring",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Modda nomi/)).toHaveValue('');
    expect(within(dialog).queryByText('AI')).toBeNull();

    await user.type(within(dialog).getByLabelText(/^Modda nomi/), 'Aspirin');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).not.toHaveProperty('ai');
  });

  it('AI 503 — xabar chiqadi, forma qo‘lda saqlanadi (ai yo‘q)', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(true) });
    api.onPost('/ai/extract/sample').reply(503, {
      error: { code: 'AI_UNAVAILABLE', message: 'AI mavjud emas', requestId: 'r1' },
    });
    let posted: Record<string, unknown> | null = null;
    api.onPost('/samples').reply((c) => {
      posted = JSON.parse(c.data as string) as Record<string, unknown>;
      return [201, { data: { id: 'new' } }];
    });
    loginAs('kontrolyor');
    const dialog = await openSampleForm(user);
    await within(dialog).findByRole('button', { name: 'Hujjatdan to‘ldirish' });
    await user.upload(fileInput(dialog), png());
    expect(
      await within(dialog).findByText(
        'AI xizmati hozir mavjud emas — maydonlarni qo‘lda to‘ldiring',
      ),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Modda nomi/), 'Aspirin');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ substanceName: 'Aspirin' });
    expect(posted).not.toHaveProperty('ai');
  });

  it('status=failed — "AI javob bermadi" xabari, ai yuborilmaydi', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(true) });
    api.onPost('/ai/extract/sample').reply(200, {
      data: sampleExtraction({ status: 'failed', errorCode: 'AI_TIMEOUT', imageQuality: null }),
    });
    let posted: Record<string, unknown> | null = null;
    api.onPost('/samples').reply((c) => {
      posted = JSON.parse(c.data as string) as Record<string, unknown>;
      return [201, { data: { id: 'new' } }];
    });
    loginAs('kontrolyor');
    const dialog = await openSampleForm(user);
    await within(dialog).findByRole('button', { name: 'Hujjatdan to‘ldirish' });
    await user.upload(fileInput(dialog), png());
    expect(
      await within(dialog).findByText("AI javob bermadi — maydonlarni qo'lda to'ldiring"),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Modda nomi/)).toHaveValue('');
    await user.type(within(dialog).getByLabelText(/^Modda nomi/), 'Aspirin');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).not.toHaveProperty('ai');
  });
});

// ---------------------------------------------------------------- Reaktiv

const reagent: ReagentDto = {
  id: 'r1',
  companyId: 'c1',
  name: 'Etanol',
  casNumber: null,
  unit: 'l',
  quantity: 1,
  lowStockThreshold: 0,
  expiresAt: '2027-01-01',
  supplier: null,
  storageConditions: null,
  isHazardous: false,
  isLowStock: false,
  isExpired: false,
  approvalStatus: 'approved',
  lotNumber: 'LOT-9',
  manufacturer: 'Merck',
  manufacturedAt: '2026-01-01',
  arrivalDate: '2026-02-01',
  createdBy: null,
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('P18: reaktiv — lot maydonlari va AI', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    api.onGet('/reagents').reply(200, { data: [reagent], meta: { page: 1, limit: 20, total: 1 } });
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('ro‘yxatda lot raqami ko‘rinadi', async () => {
    loginAs('lab_head');
    renderAt('/reagents');
    expect((await screen.findAllByText('Lot: LOT-9')).length).toBeGreaterThan(0);
  });

  it('yangi reaktiv: lot, ishlab chiqaruvchi va sanalar yuboriladi (AI o‘chiq)', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(false) });
    let posted: Record<string, unknown> | null = null;
    api.onPost('/reagents').reply((c) => {
      posted = JSON.parse(c.data as string) as Record<string, unknown>;
      return [201, { data: reagent }];
    });
    loginAs('lab_head');
    renderAt('/reagents');
    await user.click(await screen.findByRole('button', { name: /Yangi reaktiv/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Nomi/), 'Aseton');
    await user.type(within(dialog).getByLabelText(/^Lot \(seriya\) raqami/), 'L-100');
    await user.type(within(dialog).getByLabelText(/^Ishlab chiqaruvchi/), 'Sigma');
    await user.type(within(dialog).getByLabelText(/^Ishlab chiqarilgan sana/), '01.03.2026');
    await user.type(within(dialog).getByLabelText(/^Kelgan sana/), '05.03.2026');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      name: 'Aseton',
      lotNumber: 'L-100',
      manufacturer: 'Sigma',
      manufacturedAt: '2026-03-01',
      arrivalDate: '2026-03-05',
    });
    expect(posted).not.toHaveProperty('ai');
    expect(posted).not.toHaveProperty('reagentItemId');
  });

  it('tahrirlashda (PUT) lot maydonlari yuboriladi', async () => {
    const user = userEvent.setup();
    let put: Record<string, unknown> | null = null;
    api.onPut('/reagents/r1').reply((c) => {
      put = JSON.parse(c.data as string) as Record<string, unknown>;
      return [200, { data: reagent }];
    });
    loginAs('lab_head');
    renderAt('/reagents');
    await screen.findAllByText('Etanol');
    await user.click(screen.getAllByRole('button', { name: 'Tahrirlash' })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/^Lot \(seriya\) raqami/)).toHaveValue('LOT-9');
    const lot = within(dialog).getByLabelText(/^Lot \(seriya\) raqami/);
    await user.clear(lot);
    await user.type(lot, 'LOT-10');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(put).not.toBeNull());
    expect(put).toMatchObject({
      lotNumber: 'LOT-10',
      manufacturer: 'Merck',
      manufacturedAt: '2026-01-01',
      arrivalDate: '2026-02-01',
    });
  });

  it('AI: maydonlar to‘ldiriladi, katalog taklifi faqat bosilganda bog‘lanadi', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: status(true) });
    api.onPost('/ai/extract/reagent').reply(200, {
      data: {
        extractionId: 'ex-r',
        kind: 'reagent',
        status: 'ok',
        imageQuality: 'good',
        errorCode: null,
        fields: {
          name: { value: 'Etanol 96%', confidence: 'high' },
          lotNumber: { value: 'B-12', confidence: 'high' },
          manufacturer: { value: 'Merck', confidence: 'high' },
          manufacturedAt: empty,
          expiresAt: { value: '2028-05-01', confidence: 'high' },
          quantity: { value: 2.5, confidence: 'high' },
          unit: { value: 'l', confidence: 'high' },
          arrivalDate: empty,
        },
        catalogSuggestions: [
          { id: 'item-1', name: 'Etanol', unitFamily: 'volume', score: 0.8, exact: false },
        ],
      } satisfies AiExtractionDto,
    });
    let posted: Record<string, unknown> | null = null;
    api.onPost('/reagents').reply((c) => {
      posted = JSON.parse(c.data as string) as Record<string, unknown>;
      return [201, { data: reagent }];
    });
    loginAs('kontrolyor');
    renderAt('/reagents');
    await user.click(await screen.findByRole('button', { name: /Yangi reaktiv/ }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('button', { name: 'Hujjatdan to‘ldirish' });
    await user.upload(fileInput(dialog), png());
    expect(await within(dialog).findByText(/AI 6 ta maydonni to‘ldirdi/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Nomi/)).toHaveValue('Etanol 96%');
    expect(within(dialog).getByLabelText(/^Joriy zaxira/)).toHaveValue(2.5);
    const suggestion = within(dialog).getByRole('button', {
      name: 'Katalogdagi o‘xshash nom: Etanol',
    });
    await user.click(suggestion);
    expect(within(dialog).getByText('Katalogga bog‘landi')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      name: 'Etanol 96%',
      lotNumber: 'B-12',
      quantity: 2.5,
      unit: 'l',
      expiresAt: '2028-05-01',
      reagentItemId: 'item-1',
      ai: { extractionId: 'ex-r' },
    });
  });

  it('muddat ishlab chiqarilgan sanadan oldin — xato, so‘rov yuborilmaydi', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    renderAt('/reagents');
    await user.click(await screen.findByRole('button', { name: /Yangi reaktiv/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Nomi/), 'Aseton');
    // DatePicker min cheklovini chetlab o'tish uchun avval muddat, keyin ishlab chiqarilgan sana
    await user.type(within(dialog).getByLabelText(/^Yaroqlilik muddati/), '01.02.2026');
    await user.type(within(dialog).getByLabelText(/^Ishlab chiqarilgan sana/), '01.03.2026');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    expect(
      await within(dialog).findByText(
        'Yaroqlilik muddati ishlab chiqarilgan sanadan oldin bo‘lishi mumkin emas',
      ),
    ).toBeInTheDocument();
    expect(api.history.post.some((r) => r.url === '/reagents')).toBe(false);
  });
});
