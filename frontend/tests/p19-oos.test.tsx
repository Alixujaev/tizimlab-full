import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import { getTabsForRole } from '@/components/telegram/TelegramMobileShell';
import { navItemsFor } from '@/config/navigation';
import i18n from '@/i18n';
import type {
  AiStatusDto,
  ChatMessageDto,
  ChatSessionDetailDto,
  OosCaseDetailDto,
  PeakComparisonDto,
  PeakResultDto,
  ProtocolDetailDto,
  RagStatusDto,
  Role,
  SampleDetailDto,
} from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P19: OOS jurnali, AI kopilot chat, peak natijalari/solishtirish, bilim bazasi. AI hech qachon qaror chiqarmaydi. */

const tr = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;

let api: MockAdapter;

const aiStatus = (enabled: boolean): AiStatusDto => ({
  enabled,
  configured: enabled,
  companyEnabled: enabled,
  dailyLimit: 100,
  usedToday: 0,
  maxFileMb: 10,
});

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const PEAK_FILE = '33333333-3333-4333-8333-333333333333';

function oosCase(over: Partial<OosCaseDetailDto> = {}): OosCaseDetailDto {
  return {
    id: CASE_ID,
    sampleId: 's1',
    protocolId: 'p1',
    substanceName: 'Amoksitsillin',
    serialNumber: 'SN-01',
    testName: 'Assay',
    resultValue: '92.1',
    specLimit: '95.0–105.0',
    unit: '%',
    description: null,
    status: 'open',
    openedBy: 'u1',
    openedByName: 'Kimyogar',
    openedAt: '2026-03-01T10:00:00.000Z',
    rootCause: null,
    closureNote: null,
    closedBy: null,
    closedByName: null,
    closedAt: null,
    updatedAt: '2026-03-01T10:00:00.000Z',
    notes: [
      {
        id: 'n1',
        kind: 'status_change',
        text: 'open',
        userId: 'u1',
        userName: 'Kimyogar',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
    ],
    peakFiles: [{ id: PEAK_FILE, fileName: 'xromatogramma.pdf', confirmedResults: 0 }],
    ...over,
  };
}

const comparison = (over: Partial<PeakComparisonDto> = {}): PeakComparisonDto => ({
  peakFileId: PEAK_FILE,
  status: 'compared',
  historyRuns: 3,
  singleRun: false,
  criteria: {
    substanceName: 'Amoksitsillin',
    ndId: null,
    equipmentId: 'e1',
    equipmentName: 'HPLC Agilent',
  },
  historySources: [],
  peaks: [
    {
      name: 'Amoksitsillin',
      rt: 4.62,
      matchedRuns: 3,
      rtStats: { current: 4.62, n: 3, mean: 4.4, sd: 0.02, rsdPct: 0.4, deviationPct: 5 },
      areaStats: {
        current: 92,
        n: 3,
        mean: 99,
        sd: 0.5,
        rsdPct: 0.5,
        deviationPct: -7.1,
        basis: 'area_percent',
      },
      tailingStats: { current: 1.1, n: 3, mean: 1.1, sd: 0, rsdPct: 0, deviationPct: 0 },
      platesStats: { current: 5000, n: 3, mean: 5100, sd: 10, rsdPct: 0.2, deviationPct: -2 },
      resolution: 2.1,
      flags: ['rt_shift', 'new_peak'],
    },
  ],
  missingPeaks: [],
  flags: ['rt_shift'],
  thresholds: {
    rtShiftPct: 2,
    areaDevPct: 10,
    tailingMax: 2,
    tailingChangePct: 20,
    platesDropPct: 25,
    resolutionMin: 1.5,
  },
  ...over,
});

function assistant(over: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: 'm2',
    role: 'assistant',
    content: '',
    answer: {
      internal_findings: [{ source_ref: 'S1', summary: 'Avvalgi seriyada RT siljishi kuzatilgan' }],
      peak_assessment: 'RT 5% ga siljigan',
      probable_causes: [
        { cause: 'Kolonka eskirgan', basis: 'internal', source_refs: ['S1'] },
        { cause: 'Mobil faza pH noto‘g‘ri', basis: 'general', source_refs: [] },
      ],
      recommended_checks: ['Kolonkani almashtirib qayta tahlil qilish'],
      general_knowledge: ['pH o‘zgarishi RT ga ta’sir qiladi'],
      internalFound: true,
    },
    sources: [
      {
        ref: 'S1',
        sourceType: 'protocol',
        sourceId: 'p0',
        title: 'Protokol SN-00',
        substanceName: 'Amoksitsillin',
        series: 'SN-00',
        docDate: '2026-01-10',
        link: '/samples/s0',
        excerpt: 'RT 4.40 min',
        cited: true,
      },
    ],
    peakComparison: [comparison()],
    retrievalMode: 'fts_only',
    attachmentIds: [],
    model: 'x',
    inputTokens: 1,
    outputTokens: 1,
    errorCode: null,
    createdBy: null,
    createdAt: '2026-03-01T11:00:00.000Z',
    ...over,
  };
}

const userMsg: ChatMessageDto = {
  ...assistant(),
  id: 'm1',
  role: 'user',
  content: 'Nega assay past?',
  answer: null,
  sources: [],
  peakComparison: null,
  retrievalMode: null,
};

function session(messages: ChatMessageDto[] = []): ChatSessionDetailDto {
  return {
    id: SESSION_ID,
    caseId: CASE_ID,
    title: null,
    createdBy: 'u1',
    createdByName: 'Kimyogar',
    createdAt: '2026-03-01T10:30:00.000Z',
    updatedAt: '2026-03-01T10:30:00.000Z',
    messages,
    attachments: [],
  };
}

function mockCase(c: OosCaseDetailDto, opts: { ai?: boolean; messages?: ChatMessageDto[] } = {}) {
  api.onGet('/ai/status').reply(200, { data: aiStatus(opts.ai ?? true) });
  api.onGet(`/oos/${CASE_ID}`).reply(200, { data: c });
  api.onGet('/oos/chat/sessions').reply(200, { data: [session()] });
  api.onGet(`/oos/chat/sessions/${SESSION_ID}`).reply(200, { data: session(opts.messages ?? []) });
}

beforeEach(() => {
  api = new MockAdapter(apiClient);
});
afterEach(() => {
  api.restore();
  resetAuth();
});

describe('P19: OOS ro‘yxati, rollar va navigatsiya', () => {
  it('ro‘yxat chiqadi; holat filtri va qidiruv so‘rovga qo‘shiladi', async () => {
    const user = userEvent.setup();
    api.onGet('/oos').reply(200, {
      data: [oosCase(), oosCase({ id: 'c2', substanceName: 'Paratsetamol', status: 'closed' })],
      meta: { page: 1, limit: 20, total: 2 },
    });
    api.onGet('/oos/chat/sessions').reply(200, {
      data: [{ ...session(), id: 'free1', caseId: null, title: 'Umumiy savol' }],
    });
    loginAs('lab_head');
    renderAt('/oos');
    expect(await screen.findByRole('link', { name: 'Amoksitsillin' })).toHaveAttribute(
      'href',
      `/oos/${CASE_ID}`,
    );
    expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
    // Erkin AI suhbatlar va bilim bazasi havolasi (lab_head)
    expect(screen.getByText('Umumiy savol')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: tr('rag.title') })).toHaveAttribute(
      'href',
      '/knowledge-base',
    );

    await selectOption(user, screen.getByRole('combobox', { name: tr('common.status') }), 'closed');
    await waitFor(() =>
      expect(api.history.get.some((r) => r.url === '/oos' && r.params.status === 'closed')).toBe(
        true,
      ),
    );
    await user.type(screen.getByPlaceholderText(tr('oos.searchPlaceholder')), 'SN-01');
    await waitFor(() =>
      expect(api.history.get.some((r) => r.url === '/oos' && r.params.search === 'SN-01')).toBe(
        true,
      ),
    );
  });

  it('kontrolyor: /oos taqiqlangan, menyuda (sidebar va Telegram "Yana") OOS yo‘q', async () => {
    loginAs('kontrolyor');
    renderAt('/oos');
    expect(await screen.findByRole('heading', { name: tr('errors.forbiddenTitle') })).toBeVisible();
    expect(api.history.get.some((r) => r.url === '/oos')).toBe(false);

    const inNav = (role: Role) => navItemsFor(role).some((i) => i.path === '/oos');
    const inMore = (role: Role) => getTabsForRole(role).moreItems.some((i) => i.path === '/oos');
    expect(inNav('kontrolyor')).toBe(false);
    expect(inMore('kontrolyor')).toBe(false);
    for (const role of ['chemist', 'lab_head', 'director', 'admin'] as const) {
      expect(inNav(role), role).toBe(true);
      expect(inMore(role), role).toBe(true);
    }
  });

  it('bilim bazasi faqat lab_head/admin: kimyogarga taqiqlangan va havola ko‘rinmaydi', async () => {
    api.onGet('/oos').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    api.onGet('/oos/chat/sessions').reply(200, { data: [] });
    loginAs('chemist');
    const { unmount } = renderAt('/oos');
    expect(await screen.findByText(tr('oos.empty'))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: tr('rag.title') })).toBeNull();
    // Kimyogar yozuvchi — "Yangi savol" bor
    expect(screen.getByRole('button', { name: tr('oos.chat.newQuestion') })).toBeInTheDocument();
    unmount();
    renderAt('/knowledge-base');
    expect(await screen.findByRole('heading', { name: tr('errors.forbiddenTitle') })).toBeVisible();
  });
});

describe('P19: OOS ishi — holat amallari (yopish faqat lab_head)', () => {
  it('direktor: ishni ko‘radi, lekin savol formasi, izoh va holat tugmalari yo‘q', async () => {
    mockCase(oosCase(), { messages: [userMsg, assistant()] });
    loginAs('director');
    renderAt(`/oos/${CASE_ID}`);
    expect(await screen.findByRole('heading', { name: 'Amoksitsillin — Assay' })).toBeVisible();
    expect(screen.getByText('92.1 % (me’yor: 95.0–105.0)')).toBeInTheDocument();
    // Suhbat tarixi ko'rinadi, ammo forma yo'q
    expect(await screen.findByText('Nega assay past?')).toBeInTheDocument();
    expect(screen.getByText(tr('oos.chat.readOnly'))).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: tr('oos.chat.question') })).toBeNull();
    expect(screen.queryByRole('textbox', { name: tr('oos.journal.add') })).toBeNull();
    expect(screen.queryByRole('button', { name: tr('oos.actions.close') })).toBeNull();
    expect(screen.queryByRole('button', { name: tr('oos.actions.investigate') })).toBeNull();
    expect(screen.queryByRole('button', { name: tr('oos.chat.newSession') })).toBeNull();
  });

  it('kimyogar: yopish tugmasi yo‘q, tergovni boshlay oladi', async () => {
    const user = userEvent.setup();
    mockCase(oosCase());
    let body: unknown = null;
    api.onPost(`/oos/${CASE_ID}/status`).reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: oosCase({ status: 'investigating' }) }];
    });
    loginAs('chemist');
    renderAt(`/oos/${CASE_ID}`);
    await screen.findByRole('heading', { name: 'Amoksitsillin — Assay' });
    expect(screen.queryByRole('button', { name: tr('oos.actions.close') })).toBeNull();
    await user.click(screen.getByRole('button', { name: tr('oos.actions.investigate') }));
    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByRole('textbox'), 'Qayta tortish');
    await user.click(within(dialog).getByRole('button', { name: tr('oos.actions.investigate') }));
    await waitFor(() => expect(body).toEqual({ status: 'investigating', note: 'Qayta tortish' }));
  });

  it('lab_head: ConfirmDialog orqali yopadi — rootCause va closureNote yuboriladi', async () => {
    const user = userEvent.setup();
    mockCase(oosCase({ status: 'investigating' }));
    let body: unknown = null;
    api.onPost(`/oos/${CASE_ID}/status`).reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: oosCase({ status: 'closed' }) }];
    });
    loginAs('lab_head');
    renderAt(`/oos/${CASE_ID}`);
    await user.click(await screen.findByRole('button', { name: tr('oos.actions.close') }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: tr('oos.actions.close') });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('oos.fields.rootCause') }),
      'Kolonka eskirgan',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('oos.fields.closureNote') }),
      'Kolonka almashtirildi, qayta tahlil me’yorda',
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() =>
      expect(body).toEqual({
        status: 'closed',
        rootCause: 'Kolonka eskirgan',
        closureNote: 'Kolonka almashtirildi, qayta tahlil me’yorda',
      }),
    );
  });
});

describe('P19: AI kopilot chat', () => {
  it('javob 5 bo‘limda: manba havolasi, fts_only belgisi va ogohlantirish', async () => {
    const user = userEvent.setup();
    let sent = false;
    let body: unknown = null;
    mockCase(oosCase());
    api
      .onGet(`/oos/chat/sessions/${SESSION_ID}`)
      .reply(() => [200, { data: session(sent ? [userMsg, assistant()] : []) }]);
    api.onPost(`/oos/chat/sessions/${SESSION_ID}/messages`).reply((c) => {
      body = JSON.parse(c.data as string);
      sent = true;
      return [200, { data: { userMessage: userMsg, assistantMessage: assistant() } }];
    });
    loginAs('chemist');
    renderAt(`/oos/${CASE_ID}`);
    const box = await screen.findByRole('textbox', { name: tr('oos.chat.question') });
    await user.type(box, 'Nega assay past?');
    await selectOption(
      user,
      screen.getByRole('combobox', { name: tr('oos.chat.peakFile') }),
      PEAK_FILE,
    );
    await user.click(screen.getByRole('button', { name: tr('oos.chat.send') }));
    await waitFor(() =>
      expect(body).toEqual({ content: 'Nega assay past?', peakFileId: PEAK_FILE }),
    );

    for (const key of [
      'oos.answer.internal',
      'oos.answer.peaks',
      'oos.answer.causes',
      'oos.answer.checks',
      'oos.answer.general',
    ]) {
      expect(await screen.findByRole('heading', { name: tr(key) })).toBeInTheDocument();
    }
    // Manba belgisi ilova ichidagi havolaga olib boradi
    const chips = screen.getAllByRole('link', { name: '[S1]' });
    expect(chips[0]).toHaveAttribute('href', '/samples/s0');
    expect(screen.getByText(tr('oos.answer.ftsOnly'))).toBeInTheDocument();
    expect(screen.getByText(tr('oos.answer.basisGeneral'))).toBeInTheDocument();
    expect(screen.getByText(tr('oos.answer.generalWarning'))).toBeInTheDocument();
    expect(screen.getByText(tr('oos.answer.disclaimer'))).toBeInTheDocument();
    // Peak taqqoslash jadvali va belgilar
    expect(screen.getByText(tr('peaks.flags.rt_shift'))).toBeInTheDocument();
    // Muvaffaqiyatdan so'ng savol maydoni tozalanadi
    await waitFor(() => expect(box).toHaveValue(''));
    // Manbalar ro'yxati yig'iladi/ochiladi
    await user.click(screen.getByRole('button', { name: tr('oos.answer.sources', { count: 1 }) }));
    expect(screen.getByText('RT 4.40 min')).toBeInTheDocument();
  });

  it('internalFound=false — "Ichki bazada topilmadi"; javobsiz xato — qayta urinish xabari', async () => {
    const notFound = assistant({
      id: 'm3',
      answer: { ...assistant().answer!, internal_findings: [], internalFound: false },
      retrievalMode: 'hybrid',
    });
    const failed = assistant({ id: 'm4', answer: null, errorCode: 'AI_UNAVAILABLE' });
    mockCase(oosCase(), { messages: [userMsg, notFound, failed] });
    loginAs('lab_head');
    renderAt(`/oos/${CASE_ID}`);
    expect(await screen.findByText(tr('oos.answer.internalNotFound'))).toBeInTheDocument();
    expect(screen.getByText(tr('oos.answer.failed'))).toBeInTheDocument();
    expect(screen.queryByText(tr('oos.answer.ftsOnly'))).toBeNull();
  });

  it('AI 503: xato chat ichida, savol saqlanadi; jurnal ishlashda davom etadi', async () => {
    const user = userEvent.setup();
    mockCase(oosCase());
    api.onPost(`/oos/chat/sessions/${SESSION_ID}/messages`).reply(503, {
      error: { code: 'AI_UNAVAILABLE', message: 'AI unavailable' },
    });
    let note: unknown = null;
    api.onPost(`/oos/${CASE_ID}/notes`).reply((c) => {
      note = JSON.parse(c.data as string);
      return [
        201,
        {
          data: {
            id: 'n2',
            kind: 'note',
            text: 'x',
            userId: 'u1',
            userName: null,
            createdAt: '2026-03-01T12:00:00.000Z',
          },
        },
      ];
    });
    loginAs('chemist');
    renderAt(`/oos/${CASE_ID}`);
    const box = await screen.findByRole('textbox', { name: tr('oos.chat.question') });
    await user.type(box, 'Sabab nima?');
    await user.click(screen.getByRole('button', { name: tr('oos.chat.send') }));
    expect(await screen.findByText(tr('oos.errors.AI_UNAVAILABLE'))).toBeInTheDocument();
    expect(box).toHaveValue('Sabab nima?');

    await user.type(
      screen.getByRole('textbox', { name: tr('oos.journal.add') }),
      'Tarozi tekshirildi',
    );
    await user.click(screen.getByRole('button', { name: tr('oos.journal.save') }));
    await waitFor(() => expect(note).toEqual({ text: 'Tarozi tekshirildi' }));
  });

  it('AI o‘chiq: chat o‘rnida aniq xabar, forma yo‘q; jurnal ko‘rinadi', async () => {
    mockCase(oosCase(), { ai: false });
    loginAs('chemist');
    renderAt(`/oos/${CASE_ID}`);
    expect(await screen.findByText(tr('oos.chat.aiOff'))).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: tr('oos.chat.question') })).toBeNull();
    expect(screen.getByRole('textbox', { name: tr('oos.journal.add') })).toBeInTheDocument();
  });

  it('"Yangi savol": erkin suhbat yaratiladi va chat sahifasi ochiladi', async () => {
    const user = userEvent.setup();
    api.onGet('/ai/status').reply(200, { data: aiStatus(true) });
    api.onGet('/oos').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    api.onGet('/oos/chat/sessions').reply(200, { data: [] });
    let body: unknown = null;
    api.onPost('/oos/chat/sessions').reply((c) => {
      body = JSON.parse(c.data as string);
      return [201, { data: { ...session(), caseId: null } }];
    });
    api
      .onGet(`/oos/chat/sessions/${SESSION_ID}`)
      .reply(200, { data: { ...session(), caseId: null } });
    loginAs('chemist');
    const { router } = renderAt('/oos');
    await user.click(await screen.findByRole('button', { name: tr('oos.chat.newQuestion') }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/oos/chat/${SESSION_ID}`));
    expect(body).toEqual({});
    expect(
      await screen.findByRole('textbox', { name: tr('oos.chat.substanceFilter') }),
    ).toBeInTheDocument();
  });
});

describe('P19: peak natijalari va tarix bilan solishtirish', () => {
  const draft = (over: Partial<PeakResultDto> = {}): PeakResultDto => ({
    id: 'r1',
    protocolFileId: PEAK_FILE,
    peakName: 'Amoksitsillin',
    retentionTime: 4.62,
    area: 1200,
    height: null,
    areaPercent: 98.5,
    tailing: 1.1,
    plates: 5000,
    resolution: 2.1,
    source: 'manual',
    aiValue: null,
    status: 'draft',
    confirmedAt: null,
    ...over,
  });
  const results = (rows: PeakResultDto[]) => ({
    data: {
      file: {
        id: PEAK_FILE,
        protocolId: 'p1',
        fileName: 'xromatogramma.pdf',
        substanceName: 'Amoksitsillin',
        equipmentId: null,
        equipmentName: null,
        ndId: null,
        analysisDate: null,
      },
      results: rows,
    },
  });

  async function openModal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: tr('oos.peakFiles.open') }));
    return screen.findByRole('dialog', { name: tr('peaks.title') });
  }

  it('qo‘lda qator qo‘shish va tasdiqlash; AI o‘chiq — "AI bilan o‘qish" yo‘q', async () => {
    const user = userEvent.setup();
    mockCase(oosCase(), { ai: false });
    let rows: PeakResultDto[] = [];
    api.onGet(`/peaks/files/${PEAK_FILE}/results`).reply(() => [200, results(rows)]);
    let added: unknown = null;
    api.onPost(`/peaks/files/${PEAK_FILE}/results`).reply((c) => {
      added = JSON.parse(c.data as string);
      rows = [draft()];
      return [201, { data: draft() }];
    });
    let confirmed = false;
    api.onPost(`/peaks/files/${PEAK_FILE}/confirm`).reply(() => {
      confirmed = true;
      rows = [draft({ status: 'confirmed' })];
      return [200, { data: { confirmed: 1 } }];
    });
    loginAs('lab_head');
    renderAt(`/oos/${CASE_ID}`);
    const dialog = await openModal(user);
    expect(await within(dialog).findByText(tr('peaks.empty'))).toBeInTheDocument();
    expect(within(dialog).getByText(tr('peaks.confirmHint'))).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: tr('peaks.ai.extract') })).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: tr('peaks.addRow') }));
    // RT majburiy — bo'sh holda yuborilmaydi
    await user.click(within(dialog).getByRole('button', { name: tr('common.save') }));
    expect(within(dialog).getByText(tr('peaks.validation.rt'))).toBeInTheDocument();
    expect(added).toBeNull();
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('peaks.columns.peak') }),
      'Amoksitsillin',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('peaks.fields.retentionTime') }),
      '4,62',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('peaks.fields.areaPercent') }),
      '98.5',
    );
    await user.click(within(dialog).getByRole('button', { name: tr('common.save') }));
    await waitFor(() =>
      expect(added).toEqual({
        peakName: 'Amoksitsillin',
        retentionTime: 4.62,
        area: null,
        areaPercent: 98.5,
        height: null,
        tailing: null,
        plates: null,
        resolution: null,
      }),
    );
    expect(await within(dialog).findByText(tr('peaks.status.draft'))).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: tr('peaks.confirm') }));
    const confirmDialog = await screen.findByRole('alertdialog');
    await user.click(within(confirmDialog).getByRole('button', { name: tr('peaks.confirm') }));
    await waitFor(() => expect(confirmed).toBe(true));
    expect(await within(dialog).findByText(tr('peaks.status.confirmed'))).toBeInTheDocument();
  });

  it('AI yoqilgan: jadvalni o‘qish — AI qatorlari belgilanadi, past ishonch "Tekshiring"', async () => {
    const user = userEvent.setup();
    mockCase(oosCase(), { ai: true });
    let rows: PeakResultDto[] = [];
    api.onGet(`/peaks/files/${PEAK_FILE}/results`).reply(() => [200, results(rows)]);
    let body: unknown = null;
    const aiRow = draft({ source: 'ai', aiValue: { confidence: 'low' } });
    api.onPost('/ai/extract/peaks').reply((c) => {
      body = JSON.parse(c.data as string);
      rows = [aiRow];
      return [
        200,
        {
          data: {
            extractionId: 'x1',
            status: 'ok',
            imageQuality: 'good',
            errorCode: null,
            created: [aiRow],
            skipped: 0,
          },
        },
      ];
    });
    loginAs('chemist');
    renderAt(`/oos/${CASE_ID}`);
    const dialog = await openModal(user);
    await user.click(await within(dialog).findByRole('button', { name: tr('peaks.ai.extract') }));
    await waitFor(() => expect(body).toEqual({ protocolFileId: PEAK_FILE }));
    expect(await within(dialog).findByText(tr('ai.check'))).toBeInTheDocument();
    expect(within(dialog).getByText(tr('ai.badge'))).toBeInTheDocument();
  });

  it('solishtirish: belgilar jadvalda; no_history — bo‘sh holat; singleRun — RSD izohi', async () => {
    const user = userEvent.setup();
    mockCase(oosCase(), { ai: false });
    api.onGet(`/peaks/files/${PEAK_FILE}/results`).reply(200, results([]));
    api
      .onGet(`/peaks/files/${PEAK_FILE}/comparison`)
      .reply(200, { data: comparison({ singleRun: true, historyRuns: 1 }) });
    loginAs('director');
    renderAt(`/oos/${CASE_ID}`);
    const dialog = await openModal(user);
    // Direktor faqat ko'radi
    expect(within(dialog).queryByRole('button', { name: tr('peaks.addRow') })).toBeNull();
    await user.click(within(dialog).getByRole('tab', { name: tr('peaks.tabs.comparison') }));
    expect(await within(dialog).findByText(tr('peaks.flags.rt_shift'))).toBeInTheDocument();
    expect(within(dialog).getByText(tr('peaks.flags.new_peak'))).toBeInTheDocument();
    expect(within(dialog).getByText(tr('peaks.compare.singleRun'))).toBeInTheDocument();
    expect(within(dialog).getByText('HPLC Agilent')).toBeInTheDocument();
    expect(within(dialog).getByText('+5.0%', { exact: false })).toBeInTheDocument();
  });

  it('no_history — "Taqqoslash uchun tarixiy tasdiqlangan peaklar yo‘q"', async () => {
    const user = userEvent.setup();
    mockCase(oosCase(), { ai: false });
    api.onGet(`/peaks/files/${PEAK_FILE}/results`).reply(200, results([]));
    api
      .onGet(`/peaks/files/${PEAK_FILE}/comparison`)
      .reply(200, { data: comparison({ status: 'no_history', historyRuns: 0, peaks: [] }) });
    loginAs('lab_head');
    renderAt(`/oos/${CASE_ID}`);
    const dialog = await openModal(user);
    await user.click(within(dialog).getByRole('tab', { name: tr('peaks.tabs.comparison') }));
    expect(await within(dialog).findByText(tr('peaks.compare.noHistory'))).toBeInTheDocument();
  });
});

describe('P19: protokol kartasidan OOS ochish va peak natijalari', () => {
  const sample = {
    id: 's1',
    companyId: 'c1',
    type: 'raw_material',
    status: 'in_progress',
    substanceId: null,
    substanceName: 'Amoksitsillin',
    serialNumber: 'SN-01',
    lotNumber: 'LOT-01',
    quantity: null,
    manufacturer: null,
    manufacturedAt: null,
    analysisStart: null,
    analysisEnd: '2026-03-10',
    notes: null,
    createdBy: 'u2',
    assignedTo: 'u1',
    assignedBy: 'u3',
    assignedAt: '2026-03-01T10:00:00.000Z',
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    tracking: [],
  } as SampleDetailDto;

  const protocol = {
    id: 'p1',
    companyId: 'c1',
    sampleId: 's1',
    createdBy: 'u3',
    status: 'submitted',
    protocolRole: 'standard',
    filePath: 'c1/p1.pdf',
    fileName: 'natija.pdf',
    fileSize: 1000,
    fileMime: 'application/pdf',
    rejectionReason: null,
    submittedAt: null,
    approvedAt: null,
    finalizedAt: null,
    rejectedAt: null,
    equipmentId: null,
    analysisDate: null,
    createdAt: '2026-03-01T10:05:00.000Z',
    updatedAt: '2026-03-01T10:05:00.000Z',
    sampleSubstanceName: 'Amoksitsillin',
    sampleType: 'raw_material',
    sampleStatus: 'in_progress',
    sampleAssignedTo: 'u1',
    signatures: [],
    peakFiles: [
      {
        id: PEAK_FILE,
        protocolId: 'p1',
        fileId: 'f1',
        fileName: 'xromatogramma.pdf',
        fileSize: 2048,
        fileMime: 'application/pdf',
        uploadedBy: 'u1',
        uploadedByName: 'Kimyogar',
        createdAt: '2026-03-01T10:10:00.000Z',
        kind: 'peak',
      },
    ],
    rejections: [],
    equipmentName: null,
  } as unknown as ProtocolDetailDto;

  function mockSample() {
    api.onGet('/ai/status').reply(200, { data: aiStatus(false) });
    api.onGet('/samples/s1').reply(200, { data: sample });
    api.onGet('/protocols/sample/s1').reply(200, { data: [protocol] });
    api.onGet('/protocols/p1').reply(200, { data: protocol });
    api.onGet('/history/sample/s1').reply(200, { data: [] });
  }

  it('biriktirilgan kimyogar: "OOS ochish" — namuna/protokol bilan yuboriladi va ishga o‘tadi', async () => {
    const user = userEvent.setup();
    mockSample();
    let body: unknown = null;
    api.onPost('/oos').reply((c) => {
      body = JSON.parse(c.data as string);
      return [201, { data: oosCase() }];
    });
    mockCase(oosCase(), { ai: false });
    loginAs('chemist');
    const { router } = renderAt('/samples/s1');
    await user.click(await screen.findByRole('button', { name: tr('oos.open.button') }));
    const dialog = await screen.findByRole('dialog', { name: tr('oos.open.title') });
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('oos.fields.testName') }),
      'Assay',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('oos.fields.resultValue') }),
      '92.1',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: tr('oos.fields.specLimit') }),
      '95–105',
    );
    await user.click(within(dialog).getByRole('button', { name: tr('oos.open.submit') }));
    await waitFor(() =>
      expect(body).toEqual({
        sampleId: 's1',
        protocolId: 'p1',
        testName: 'Assay',
        resultValue: '92.1',
        specLimit: '95–105',
        unit: null,
        description: null,
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/oos/${CASE_ID}`));
  });

  it('direktor: "OOS ochish" yo‘q, lekin peak natijalarini ko‘ra oladi', async () => {
    const user = userEvent.setup();
    mockSample();
    api.onGet(`/peaks/files/${PEAK_FILE}/results`).reply(200, {
      data: {
        file: {
          id: PEAK_FILE,
          protocolId: 'p1',
          fileName: 'xromatogramma.pdf',
          substanceName: null,
          equipmentId: null,
          equipmentName: null,
          ndId: null,
          analysisDate: null,
        },
        results: [],
      },
    });
    loginAs('director');
    renderAt('/samples/s1');
    await user.click(await screen.findByRole('button', { name: tr('peaks.open') }));
    expect(await screen.findByRole('dialog', { name: tr('peaks.title') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tr('oos.open.button') })).toBeNull();
    expect(screen.queryByRole('button', { name: tr('peaks.addRow') })).toBeNull();
  });
});

describe('P19: bilim bazasi (RAG)', () => {
  const status: RagStatusDto = {
    searchMode: 'fts_only',
    embeddingModel: null,
    jobs: [{ status: 'done', sourceType: 'protocol', count: 12 }],
    chunks: [{ sourceType: 'protocol', count: 40, withEmbedding: 0 }],
    failed: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        sourceType: 'nd',
        sourceId: 'nd1',
        lastError: 'PDF o‘qilmadi',
        attempts: 3,
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
    ],
  };

  it('holat sahifasi chiqadi; qayta indekslash va qayta urinish POST yuboradi', async () => {
    const user = userEvent.setup();
    api.onGet('/rag/status').reply(200, { data: status });
    api.onPost('/rag/reindex').reply(200, { data: { queued: 7 } });
    api
      .onPost(`/rag/jobs/${status.failed[0]!.id}/retry`)
      .reply(200, { data: { status: 'pending' } });
    loginAs('admin');
    renderAt('/knowledge-base');
    expect(await screen.findByRole('heading', { name: tr('rag.title') })).toBeVisible();
    expect(screen.getAllByText(tr('rag.mode.fts_only')).length).toBeGreaterThan(0);
    expect(screen.getByText('PDF o‘qilmadi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: tr('rag.reindex') }));
    await waitFor(() => expect(api.history.post.some((r) => r.url === '/rag/reindex')).toBe(true));
    await user.click(screen.getByRole('button', { name: tr('common.retry') }));
    await waitFor(() => expect(api.history.post.some((r) => r.url?.endsWith('/retry'))).toBe(true));
  });
});
