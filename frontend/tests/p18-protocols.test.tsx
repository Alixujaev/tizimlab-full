import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import { getTabsForRole } from '@/components/telegram/TelegramMobileShell';
import type {
  ProtocolDetailDto,
  ProtocolListItemDto,
  SampleDetailDto,
  TemperatureSuggestionDto,
} from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P18: protokol yuborish (apparat, sana, harorat taklifi — D-184/D-188), peak fayllar (D-185),
 *  rad etish tarixi (D-186), protokollar ro'yxati va reyestr apparat filtri (D-187). Test foydalanuvchisi u1. */

let api: MockAdapter;

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

function protocol(over: Partial<ProtocolDetailDto> = {}): ProtocolDetailDto {
  return {
    id: 'p1',
    companyId: 'c1',
    sampleId: 's1',
    createdBy: 'u3',
    status: 'draft',
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
    peakFiles: [],
    rejections: [],
    equipmentName: null,
    ...over,
  } as ProtocolDetailDto;
}

const sensors = [
  {
    id: 'sens-1',
    companyId: 'c1',
    sensorId: 'S-1',
    locationName: 'Xona-1',
    tempMin: 15,
    tempMax: 25,
    humidityMin: null,
    humidityMax: null,
    isActive: true,
  },
  {
    id: 'sens-2',
    companyId: 'c1',
    sensorId: 'S-2',
    locationName: 'Xona-2',
    tempMin: 15,
    tempMax: 25,
    humidityMin: null,
    humidityMax: null,
    isActive: true,
  },
];

const equipment = {
  data: [
    {
      id: 'e1',
      companyId: 'c1',
      name: 'HPLC Agilent',
      category: 'HPLC',
      model: null,
      serialNumber: null,
      location: null,
      status: 'active',
      calibrationDue: null,
      isCalibrationExpired: false,
      isCalibrationDueSoon: false,
      isUsable: true,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 100, total: 1 },
};

const suggestion = (over: Partial<TemperatureSuggestionDto> = {}): TemperatureSuggestionDto => ({
  analysisDate: '2026-03-10',
  sensorConfigId: 'sens-1',
  locationName: 'Xona-1',
  roomSource: 'single_room',
  status: 'ok',
  reading: {
    readingId: 'rd1',
    temperature: 22,
    humidity: 45,
    recordedAt: '2026-03-10T08:00:00.000Z',
    isManual: false,
    alertTriggered: false,
    locationName: 'Xona-1',
  },
  limits: { tempMin: 15, tempMax: 25 },
  outOfRange: false,
  ...over,
});

function mock(p: ProtocolDetailDto) {
  api.onGet('/samples/s1').reply(200, { data: sample });
  api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
  api.onGet('/protocols/p1').reply(200, { data: p });
  api.onGet('/temperature/sensors').reply(200, { data: sensors });
  api.onGet('/equipment').reply(200, equipment);
  api.onGet('/history/sample/s1').reply(200, { data: [] });
}

describe('P18: protokol yuborish — apparat, tahlil sanasi, harorat taklifi', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('taklif: xona oldindan tanlanadi, sana taklifdan; "Noma‘lum" → equipmentId: null', async () => {
    const user = userEvent.setup();
    mock(protocol());
    api.onGet('/protocols/p1/temperature-suggestion').reply(200, { data: suggestion() });
    let body: unknown = null;
    api.onPost('/protocols/p1/submit').reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: protocol({ status: 'submitted' }) }];
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    expect(await screen.findByText(/22 °C, 45% — Xona-1/)).toBeInTheDocument();
    expect(screen.getByText('Me’yor: 15…25 °C')).toBeInTheDocument();
    expect(screen.getByLabelText('Tahlil sanasi')).toHaveValue('10.03.2026');
    expect(screen.getByLabelText(/^Apparat/)).toHaveTextContent('Noma’lum');
    await user.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() =>
      expect(body).toEqual({
        sensorConfigId: 'sens-1',
        equipmentId: null,
        analysisDate: '2026-03-10',
      }),
    );
  });

  it('apparat tanlansa equipmentId yuboriladi; xona almashsa taklif qayta so‘raladi', async () => {
    const user = userEvent.setup();
    mock(protocol());
    api.onGet('/protocols/p1/temperature-suggestion').reply((c) => {
      const room = (c.params as { sensorConfigId?: string }).sensorConfigId;
      return [
        200,
        {
          data:
            room === 'sens-2'
              ? suggestion({
                  sensorConfigId: 'sens-2',
                  locationName: 'Xona-2',
                  roomSource: 'request',
                  status: 'no_reading',
                  reading: null,
                })
              : suggestion(),
        },
      ];
    });
    let body: unknown = null;
    api.onPost('/protocols/p1/submit').reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: protocol({ status: 'submitted' }) }];
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    await screen.findByText(/22 °C, 45% — Xona-1/);
    await selectOption(user, screen.getByLabelText(/^Apparat/), 'e1');
    await selectOption(user, screen.getByLabelText('Tahlil o‘tkazilgan xona'), 'sens-2');
    expect(
      await screen.findByText('Tanlangan sana va xona uchun harorat yozuvi yo‘q'),
    ).toBeInTheDocument();
    expect(
      api.history.get.some(
        (r) =>
          r.url === '/protocols/p1/temperature-suggestion' &&
          (r.params as { sensorConfigId?: string }).sensorConfigId === 'sens-2',
      ),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() =>
      expect(body).toEqual({
        sensorConfigId: 'sens-2',
        equipmentId: 'e1',
        analysisDate: '2026-03-10',
      }),
    );
  });

  it('outOfRange — "Harorat me‘yordan tashqarida" ogohlantirishi', async () => {
    mock(protocol());
    api.onGet('/protocols/p1/temperature-suggestion').reply(200, {
      data: suggestion({
        outOfRange: true,
        reading: { ...suggestion().reading!, temperature: 31, alertTriggered: true },
      }),
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    expect(await screen.findByText('Harorat me’yordan tashqarida')).toBeInTheDocument();
  });

  it('no_room — "Xona tanlanmagan"', async () => {
    mock(protocol());
    api.onGet('/protocols/p1/temperature-suggestion').reply(200, {
      data: suggestion({
        sensorConfigId: null,
        locationName: null,
        roomSource: null,
        status: 'no_room',
        reading: null,
        limits: null,
      }),
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    expect(await screen.findByText('Xona tanlanmagan')).toBeInTheDocument();
  });

  it('protokolda apparat va tahlil sanasi, barcha rad etish sabablari ko‘rinadi', async () => {
    mock(
      protocol({
        status: 'rejected',
        rejectionReason: 'Ikkinchi sabab',
        equipmentId: 'e1',
        equipmentName: 'HPLC Agilent',
        analysisDate: '2026-03-09',
        rejections: [
          {
            id: 'j1',
            reason: 'Birinchi sabab',
            rejectedBy: 'u3',
            rejectedByName: 'Mudir M.',
            rejectedAt: '2026-03-05T10:00:00.000Z',
          },
          {
            id: 'j2',
            reason: 'Ikkinchi sabab',
            rejectedBy: 'u3',
            rejectedByName: 'Mudir M.',
            rejectedAt: '2026-03-07T10:00:00.000Z',
          },
        ],
      }),
    );
    loginAs('lab_head');
    renderAt('/samples/s1');
    expect(await screen.findByText('Rad etish tarixi (2)')).toBeInTheDocument();
    expect(screen.getByText('Birinchi sabab')).toBeInTheDocument();
    expect(screen.getAllByText('Ikkinchi sabab').length).toBeGreaterThan(0);
    expect(screen.getByText('HPLC Agilent')).toBeInTheDocument();
    expect(screen.getByText('09.03.2026')).toBeInTheDocument();
  });

  it('peak fayllar: ro‘yxat, yuklash (POST /peaks) va o‘chirish (DELETE)', async () => {
    const user = userEvent.setup();
    mock(
      protocol({
        peakFiles: [
          {
            id: 'pf1',
            protocolId: 'p1',
            fileId: 'f1',
            fileName: 'peak-1.pdf',
            fileSize: 2048,
            fileMime: 'application/pdf',
            uploadedBy: 'u1',
            uploadedByName: 'Kimyogar',
            createdAt: '2026-03-10T09:00:00.000Z',
            kind: 'peak',
          },
        ],
      }),
    );
    api.onGet('/protocols/p1/temperature-suggestion').reply(200, { data: suggestion() });
    api.onPost('/protocols/p1/peaks').reply(201, { data: { id: 'pf2' } });
    api.onDelete('/protocols/p1/peaks/pf1').reply(200, { data: { success: true } });
    api
      .onGet('/protocols/p1/files/pf1')
      .reply(200, { data: { url: 'https://x/peak', expiresIn: 300 } });
    loginAs('chemist');
    renderAt('/samples/s1');
    expect(await screen.findByText('peak-1.pdf')).toBeInTheDocument();
    expect(screen.getByText('1/20')).toBeInTheDocument();

    const uploadBtn = screen.getByRole('button', { name: 'Peak faylini yuklash' });
    const input = uploadBtn.parentElement!.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(['%PDF'], 'peak-2.pdf', { type: 'application/pdf' }));
    await waitFor(() =>
      expect(api.history.post.some((r) => r.url === '/protocols/p1/peaks')).toBe(true),
    );

    const row = screen.getByText('peak-1.pdf').closest<HTMLElement>('div.flex.flex-col')!;
    await user.click(within(row).getByRole('button', { name: "O'chirish" }));
    await waitFor(() =>
      expect(api.history.delete.some((r) => r.url === '/protocols/p1/peaks/pf1')).toBe(true),
    );
  });
});

// ---------------------------------------------------------------- Ro'yxat

const listItem = (over: Partial<ProtocolListItemDto> = {}): ProtocolListItemDto => ({
  id: 'p1',
  sampleId: 's1',
  substanceName: 'Amoksitsillin',
  serialNumber: 'SN-01',
  lotNumber: 'LOT-01',
  sampleType: 'raw_material',
  status: 'approved',
  protocolRole: 'standard',
  chemistId: 'ch1',
  chemistName: 'Ali Valiyev',
  equipmentId: null,
  equipmentName: null,
  analysisDate: '2026-03-10',
  date: '2026-03-10T10:00:00.000Z',
  submittedAt: '2026-03-10T10:00:00.000Z',
  approvedAt: '2026-03-11T10:00:00.000Z',
  fileName: 'natija.pdf',
  peakFiles: [{ id: 'pf1', fileName: 'peak-1.pdf' }],
  rejectionCount: 2,
  ...over,
});

describe('P18: Protokollar sahifasi va reyestr apparat filtri', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    api
      .onGet('/registry/chemists')
      .reply(200, { data: [{ id: 'ch1', fullName: 'Ali Valiyev', isActive: true }] });
    api.onGet('/equipment').reply(200, equipment);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('qatorlar: modda havolasi, apparat "Noma‘lum", peak fayllar, rad etishlar soni', async () => {
    api
      .onGet('/protocols')
      .reply(200, { data: [listItem()], meta: { page: 1, limit: 20, total: 1 } });
    loginAs('lab_head');
    renderAt('/protocols');
    expect(await screen.findByRole('heading', { name: 'Protokollar' })).toBeInTheDocument();
    const links = await screen.findAllByRole('link', { name: 'Amoksitsillin' });
    expect(links[0]).toHaveAttribute('href', '/samples/s1');
    expect(screen.getAllByRole('button', { name: 'peak-1.pdf' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rad: 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Noma’lum').length).toBeGreaterThan(0);
  });

  it('filtrlar so‘rovga ketadi: equipmentId=unknown, status, hasPeaks, substanceName', async () => {
    const user = userEvent.setup();
    api.onGet('/protocols').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    loginAs('chemist');
    renderAt('/protocols');
    await screen.findByRole('heading', { name: 'Protokollar' });
    await user.type(screen.getByLabelText('Modda nomi'), 'Amoks');
    await selectOption(user, screen.getByLabelText('Apparat'), 'unknown');
    await selectOption(user, screen.getByLabelText('Holati'), 'rejected');
    await user.click(screen.getByLabelText('Faqat peak fayli borlar'));
    await user.click(screen.getByRole('button', { name: 'Qidirish' }));
    await waitFor(() =>
      expect(
        api.history.get.some(
          (r) =>
            r.url === '/protocols' &&
            r.params.equipmentId === 'unknown' &&
            r.params.status === 'rejected' &&
            r.params.hasPeaks === 'true' &&
            r.params.substanceName === 'Amoks',
        ),
      ).toBe(true),
    );
  });

  it('peak faylini yuklab olish — GET /protocols/:id/files/:fileId', async () => {
    const user = userEvent.setup();
    api
      .onGet('/protocols')
      .reply(200, { data: [listItem()], meta: { page: 1, limit: 20, total: 1 } });
    api
      .onGet('/protocols/p1/files/pf1')
      .reply(200, { data: { url: 'https://x/peak', expiresIn: 300 } });
    const opened: string[] = [];
    const orig = window.open;
    window.open = ((url: string) => {
      opened.push(url);
      return null;
    }) as typeof window.open;
    try {
      loginAs('director');
      renderAt('/protocols');
      const btns = await screen.findAllByRole('button', { name: 'peak-1.pdf' });
      await user.click(btns[0]!);
      await waitFor(() => expect(opened).toEqual(['https://x/peak']));
    } finally {
      window.open = orig;
    }
  });

  it('reyestr: "Apparat ko‘rsatilmagan" filtri equipmentId=unknown yuboradi', async () => {
    const user = userEvent.setup();
    api.onGet('/registry').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    loginAs('lab_head');
    renderAt('/registry');
    await selectOption(user, await screen.findByLabelText('Apparat'), 'unknown');
    await user.click(screen.getByRole('button', { name: 'Qidirish' }));
    await waitFor(() =>
      expect(
        api.history.get.some((r) => r.url === '/registry' && r.params.equipmentId === 'unknown'),
      ).toBe(true),
    );
  });

  it('Telegram "Yana" menyusi: chemist va lab_head da Protokollar bor, kontrolyorda yo‘q', () => {
    const has = (role: Parameters<typeof getTabsForRole>[0]) =>
      getTabsForRole(role).moreItems.some((i) => i.path === '/protocols');
    expect(has('chemist')).toBe(true);
    expect(has('lab_head')).toBe(true);
    expect(has('admin')).toBe(true);
    expect(has('kontrolyor')).toBe(false);
  });
});
