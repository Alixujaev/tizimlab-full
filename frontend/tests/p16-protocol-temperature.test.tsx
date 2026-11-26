import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { ProtocolDetailDto, SampleDetailDto } from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P16 / TZ §3.5 — protokolga xona harorati (D-173). Test foydalanuvchisi id = 'u1' (biriktirilgan kimyogar). */

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
    createdAt: '2026-03-01T10:05:00.000Z',
    updatedAt: '2026-03-01T10:05:00.000Z',
    sampleSubstanceName: 'Amoksitsillin',
    sampleType: 'raw_material',
    sampleStatus: 'in_progress',
    sampleAssignedTo: 'u1',
    signatures: [],
    ...over,
  } as ProtocolDetailDto;
}

function mock(p: ProtocolDetailDto, s: SampleDetailDto = sample) {
  api.onGet('/samples/s1').reply(200, { data: s });
  api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
  api.onGet('/protocols/p1').reply(200, { data: p });
  api.onGet('/temperature/sensors').reply(200, {
    data: [
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
        locationName: 'Eski xona',
        tempMin: 15,
        tempMax: 25,
        humidityMin: null,
        humidityMax: null,
        isActive: false,
      },
    ],
  });
}

describe('P16: protokol harorati (UI)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('kimyogar xonani tanlaydi va yuborishda sensorConfigId ketadi (nofaol xona ro‘yxatda yo‘q)', async () => {
    const user = userEvent.setup();
    mock(protocol());
    let body: unknown = null;
    api.onPost('/protocols/p1/submit').reply((config) => {
      body = JSON.parse(config.data as string);
      return [200, { data: protocol({ status: 'submitted' }) }];
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    const select = await screen.findByLabelText('Tahlil o‘tkazilgan xona');
    await user.click(select);
    expect(screen.queryByText('Eski xona (S-2)')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await selectOption(user, select, 'sens-1');
    await user.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() => expect(body).toEqual({ sensorConfigId: 'sens-1' }));
  });

  it('xona tanlanmasa sensorConfigId: null yuboriladi', async () => {
    const user = userEvent.setup();
    mock(protocol());
    let body: unknown = null;
    api.onPost('/protocols/p1/submit').reply((config) => {
      body = JSON.parse(config.data as string);
      return [200, { data: protocol({ status: 'submitted' }) }];
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    await user.click(await screen.findByRole('button', { name: 'Yuborish' }));
    await waitFor(() => expect(body).toEqual({ sensorConfigId: null }));
  });

  it('yuborilgan protokolda snapshot ko‘rinadi; lab_head uchun xona tanlovi yo‘q', async () => {
    mock(
      protocol({
        status: 'submitted',
        temperatureSnapshot: {
          readingId: 'r1',
          sensorConfigId: 'sens-1',
          sensorId: 'S-1',
          locationName: 'Xona-1',
          temperature: 22,
          humidity: 45,
          recordedAt: '2026-03-10T08:00:00.000Z',
          isManual: true,
          alertTriggered: false,
          analysisDate: '2026-03-10',
          capturedAt: '2026-03-10T09:00:00.000Z',
        },
        temperatureWarning: null,
      }),
    );
    loginAs('lab_head');
    renderAt('/samples/s1');
    expect(await screen.findByText('Xona harorati (tahlil vaqtida)')).toBeInTheDocument();
    expect(screen.getByText(/22 °C, 45% — Xona-1/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tahlil o‘tkazilgan xona')).not.toBeInTheDocument();
  });

  it.each([
    ['no_reading', 'Tanlangan xona uchun tahlil sanasida (±24 soat) harorat yozuvi topilmadi.'],
    ['no_room', 'Xona tanlanmagan — harorat protokolga bog‘lanmadi.'],
  ] as const)('%s ogohlantirishi aniq ko‘rsatiladi', async (warning, text) => {
    mock(protocol({ status: 'submitted', temperatureSnapshot: null, temperatureWarning: warning }));
    loginAs('lab_head');
    renderAt('/samples/s1');
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});
