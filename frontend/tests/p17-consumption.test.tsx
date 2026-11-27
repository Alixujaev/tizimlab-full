import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { ConsumptionDto, ProtocolDetailDto, SampleDetailDto } from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P17 UI — protokol yuborishda ND tanlash va avto-sarf paneli (D-177). Test foydalanuvchisi 'u1' — biriktirilgan kimyogar. */

let api: MockAdapter;

const sample = {
  id: 's1',
  companyId: 'c1',
  type: 'raw_material',
  status: 'in_progress',
  substanceId: null,
  substanceName: 'Paratsetamol',
  serialNumber: null,
  lotNumber: null,
  quantity: null,
  manufacturer: null,
  manufacturedAt: null,
  analysisStart: null,
  analysisEnd: null,
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

const protocol = (over: Partial<ProtocolDetailDto> = {}) =>
  ({
    id: 'p1',
    companyId: 'c1',
    sampleId: 's1',
    createdBy: 'u3',
    status: 'draft',
    protocolRole: 'standard',
    filePath: 'c1/p1.pdf',
    fileName: 'p.pdf',
    fileSize: 1000,
    fileMime: 'application/pdf',
    rejectionReason: null,
    submittedAt: null,
    approvedAt: null,
    finalizedAt: null,
    rejectedAt: null,
    createdAt: '2026-03-01T10:05:00.000Z',
    updatedAt: '2026-03-01T10:05:00.000Z',
    sampleSubstanceName: 'Paratsetamol',
    sampleType: 'raw_material',
    sampleStatus: 'in_progress',
    sampleAssignedTo: 'u1',
    signatures: [],
    ...over,
  }) as ProtocolDetailDto;

const consumption: ConsumptionDto = {
  id: 'c1',
  protocolId: 'p1',
  ndId: 'nd1',
  reagentItemId: 'i1',
  reagentItemName: 'Sulfat kislota',
  unit: 'ml',
  requiredQty: 4,
  consumedQty: 3,
  shortfallQty: 1,
  status: 'auto',
  correctionReason: null,
  reviewedBy: null,
  reviewedAt: null,
  lots: [
    {
      reagentId: 'l1',
      reagentName: 'Sulfat kislota',
      quantity: 3,
      unit: 'ml',
      expiresAt: '2026-12-01',
    },
  ],
  createdAt: '2026-03-01T11:00:00.000Z',
};

function mock(p: ProtocolDetailDto) {
  api.onGet('/samples/s1').reply(200, { data: sample });
  api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
  api.onGet('/protocols/p1').reply(200, { data: p });
  api.onGet('/temperature/sensors').reply(200, { data: [] });
  api.onGet('/nd').reply(200, {
    data: [
      {
        id: 'nd1',
        code: 'ND-42',
        name: 'Paratsetamol',
        version: null,
        status: 'approved',
        approvedBy: null,
        approvedAt: null,
        fileName: null,
        fileSize: null,
        hasFile: false,
        requirementCount: 1,
        createdAt: '',
        updatedAt: '',
      },
    ],
    meta: { page: 1, limit: 100, total: 1 },
  });
  api.onGet('/consumptions/protocol/p1').reply(200, { data: [consumption] });
}

describe('P17: protokol — ND va avto-sarf', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('kimyogar tasdiqlangan ND va tahlillar sonini tanlaydi — submit body da ndId, nAnalyses', async () => {
    const user = userEvent.setup();
    mock(protocol());
    let body: unknown = null;
    api.onPost('/protocols/p1/submit').reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: protocol({ status: 'submitted' }) }];
    });
    loginAs('chemist');
    renderAt('/samples/s1');
    const select = await screen.findByLabelText('Normativ hujjat (ND)');
    await selectOption(user, select, 'nd1');
    const n = screen.getByLabelText('Tahlillar soni');
    await user.clear(n);
    await user.type(n, '2');
    await user.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() =>
      expect(body).toEqual({ sensorConfigId: null, equipmentId: null, ndId: 'nd1', nAnalyses: 2 }),
    );
  });

  it('sarf paneli: lotlar, yetishmovchilik; kimyogar tasdiqlaydi (POST confirm)', async () => {
    const user = userEvent.setup();
    mock(protocol({ status: 'submitted', ndId: 'nd1', nAnalyses: 2 }));
    api
      .onPost('/consumptions/c1/confirm')
      .reply(200, { data: { ...consumption, status: 'confirmed' } });
    loginAs('chemist');
    renderAt('/samples/s1');
    expect((await screen.findAllByText('ND bo‘yicha reaktiv sarfi')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 / 4 ml').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yetmadi: 1 ml').length).toBeGreaterThan(0);
    expect(screen.getByText(/laboratoriya mudiriga xabar yuborildi/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Tasdiqlash' })[0]!);
    await waitFor(() =>
      expect(api.history.post.some((r) => r.url === '/consumptions/c1/confirm')).toBe(true),
    );
  });

  it('tuzatish: sabab 5 belgidan kam — xato; to‘g‘ri — POST correct { quantity, reason }', async () => {
    const user = userEvent.setup();
    mock(protocol({ status: 'submitted', ndId: 'nd1' }));
    let body: unknown = null;
    api.onPost('/consumptions/c1/correct').reply((c) => {
      body = JSON.parse(c.data as string);
      return [200, { data: { ...consumption, status: 'corrected' } }];
    });
    loginAs('lab_head');
    renderAt('/samples/s1');
    await user.click((await screen.findAllByRole('button', { name: 'Tuzatish' }))[0]!);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Haqiqiy sarf/), '2');
    await user.type(within(dialog).getByLabelText(/Tuzatish sababi/), 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    expect(
      within(dialog).getByText('Sabab kamida 5 ta belgidan iborat bo‘lishi shart'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Tuzatish sababi/), 'de bekor');
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(body).toEqual({ quantity: 2, reason: 'abcde bekor' }));
  });

  it('director sarfni ko‘radi, lekin tasdiqlash/tuzatish tugmalari yo‘q', async () => {
    mock(protocol({ status: 'submitted', ndId: 'nd1' }));
    loginAs('director');
    renderAt('/samples/s1');
    await screen.findAllByText('ND bo‘yicha reaktiv sarfi');
    expect(screen.queryByRole('button', { name: 'Tuzatish' })).not.toBeInTheDocument();
  });
});
