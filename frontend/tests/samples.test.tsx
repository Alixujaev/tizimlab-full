import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { AdminUserDto, SampleDetailDto, SampleDto, SubstanceDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

let api: MockAdapter;

const mockSubstances: SubstanceDto[] = [
  {
    id: 'sub-1',
    nameUz: 'Paratsetamol',
    nameRu: 'Парацетамол',
    nameEn: 'Paracetamol',
    pharmacopoeia: 'USP',
    casNumber: '103-90-2',
    description: null,
    isActive: true,
    createdBy: 'u1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    companyId: 'c1',
  },
];

const mockChemists: AdminUserDto[] = [
  {
    id: 'chem-1',
    email: 'chemist1@test.uz',
    fullName: 'Aziz Kimyogar',
    role: 'chemist',
    isActive: true,
    companyId: 'c1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    lastLoginAt: null,
  },
];

const mockSamples: SampleDto[] = [
  {
    id: 'sample-1',
    companyId: 'c1',
    type: 'raw_material',
    status: 'pending_assignment',
    substanceId: 'sub-1',
    substanceName: 'Paratsetamol',
    serialNumber: 'SN-001',
    lotNumber: 'LOT-100',
    quantity: '100 kg',
    manufacturer: 'Test Zavod',
    manufacturedAt: '2026-01-01',
    analysisStart: null,
    analysisEnd: null,
    notes: 'Izoh yo‘q',
    createdBy: 'u1',
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'sample-2',
    companyId: 'c1',
    type: 'reagent',
    status: 'pending_assignment',
    substanceId: null,
    substanceName: 'Natriy gidroksid',
    serialNumber: null,
    lotNumber: 'NaOH-99',
    quantity: '50 L',
    manufacturer: 'Reagent Lab',
    manufacturedAt: '2026-01-10',
    analysisStart: null,
    analysisEnd: null,
    notes: null,
    createdBy: 'u1',
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z',
  },
  {
    id: 'sample-3',
    companyId: 'c1',
    type: 'raw_material',
    status: 'in_progress',
    substanceId: 'sub-1',
    substanceName: 'Aspirin xomashyo',
    serialNumber: 'SN-003',
    lotNumber: 'LOT-300',
    quantity: '200 kg',
    manufacturer: 'Pharma corp',
    manufacturedAt: '2026-02-01',
    analysisStart: '2026-03-01',
    analysisEnd: '2026-03-10',
    notes: null,
    createdBy: 'u1',
    assignedTo: 'u1', // u1 is current user id from helpers.ts
    assignedBy: 'u2',
    assignedAt: '2026-03-01T11:00:00.000Z',
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T11:00:00.000Z',
  },
  {
    id: 'sample-4',
    companyId: 'c1',
    type: 'raw_material',
    status: 'stopped',
    substanceId: 'sub-1',
    substanceName: 'To‘xtatilgan namuna',
    serialNumber: 'SN-004',
    lotNumber: 'LOT-400',
    quantity: '50 kg',
    manufacturer: 'Pharma corp',
    manufacturedAt: '2026-02-01',
    analysisStart: '2026-03-01',
    analysisEnd: '2026-03-10',
    notes: null,
    createdBy: 'u1',
    assignedTo: 'u1', // u1 is current user id
    assignedBy: 'u2',
    assignedAt: '2026-03-01T11:00:00.000Z',
    stopReason: 'Reaktiv tugab qoldi',
    stoppedAt: '2026-03-02T12:00:00.000Z',
    deletedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-02T12:00:00.000Z',
  },
];

const mockDetailSample1: SampleDetailDto = {
  ...mockSamples[0]!,
  tracking: [
    {
      id: 'trk-1',
      sampleId: 'sample-1',
      eventType: 'sample_created',
      userId: 'u1',
      userFullName: 'Test Foydalanuvchi',
      fromStatus: null,
      toStatus: 'pending_assignment',
      reason: null,
      metadata: {},
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  ],
};

describe('Samples Module (P4a Frontend)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);

    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 100, total: mockSubstances.length },
    });

    api.onGet(/\/admin\/users/).reply(200, {
      data: mockChemists,
      meta: { page: 1, limit: 100, total: mockChemists.length },
    });

    api.onGet('/samples').reply(200, {
      data: mockSamples,
      meta: { page: 1, limit: 20, total: mockSamples.length },
    });

    api.onGet('/samples/sample-1').reply(200, {
      data: mockDetailSample1,
    });
  });

  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('kontrolyor sees "+ Yangi namuna" button and sample list', async () => {
    loginAs('kontrolyor');
    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /\+ Yangi namuna/i }),
    ).toBeInTheDocument();
  });

  it('lab_head and chemist do not see "+ Yangi namuna" button', async () => {
    loginAs('lab_head');
    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /\+ Yangi namuna/i }),
    ).not.toBeInTheDocument();
  });

  it('lab_head sees "Biriktirish" button on assignable samples but not on reagents', async () => {
    loginAs('lab_head');
    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
      expect(screen.getByText('Natriy gidroksid')).toBeInTheDocument();
    });

    // Sample-1 is raw_material -> assignable
    // Sample-2 is reagent -> not assignable via chemist (R-PASS-23, D-39)
    const rows = screen.getAllByRole('row');
    // Header is row 0. Find row containing Paratsetamol
    const paracetamolRow = rows.find((r) => within(r).queryByText('Paratsetamol'));
    expect(paracetamolRow).toBeDefined();
    expect(
      within(paracetamolRow!).getByRole('button', { name: /Biriktirish/i }),
    ).toBeInTheDocument();

    const reagentRow = rows.find((r) => within(r).queryByText('Natriy gidroksid'));
    expect(reagentRow).toBeDefined();
    expect(
      within(reagentRow!).queryByRole('button', { name: /Biriktirish/i }),
    ).not.toBeInTheDocument();
  });

  it('kontrolyor can open create modal and submits new sample', async () => {
    const user = userEvent.setup();
    loginAs('kontrolyor');

    api.onPost('/samples').reply(201, {
      data: {
        id: 'sample-new',
        companyId: 'c1',
        type: 'raw_material',
        status: 'pending_assignment',
        substanceName: 'Paratsetamol',
        lotNumber: 'LOT-999',
        createdAt: '2026-03-03T00:00:00.000Z',
        updatedAt: '2026-03-03T00:00:00.000Z',
      },
    });

    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /\+ Yangi namuna/i });
    await user.click(createBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Select substance from dropdown
    const selectEl = screen.getByLabelText(/Moddalar bazasidan tanlash/i);
    await user.selectOptions(selectEl, 'sub-1');

    // Substance name is auto-filled
    const nameInput = screen.getByLabelText(/^Modda nomi/i);
    expect(nameInput).toHaveValue('Paratsetamol');

    // Fill lot number
    const lotInput = screen.getByLabelText(/Partiya \(Lot\) raqami/i);
    await user.type(lotInput, 'LOT-999');

    // Submit
    const saveBtn = screen.getByRole('button', { name: /Saqlash/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('lab_head can open assign modal and assign a chemist', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');

    api.onPost('/samples/sample-1/assign').reply(200, {
      data: {
        ...mockSamples[0]!,
        status: 'in_progress',
        assignedTo: 'chem-1',
      },
    });

    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    const paracetamolRow = rows.find((r) => within(r).queryByText('Paratsetamol'));
    const assignBtn = within(paracetamolRow!).getByRole('button', { name: /Biriktirish/i });
    await user.click(assignBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Select chemist
    await waitFor(() => {
      expect(screen.getByText(/Aziz Kimyogar/i)).toBeInTheDocument();
    });

    const chemistSelect = screen.getByLabelText(/Kimyogarni tanlang/i);
    await user.selectOptions(chemistSelect, 'chem-1');

    const dialog = screen.getByRole('dialog');
    const submitAssignBtn = within(dialog).getByRole('button', { name: /^Biriktirish$/i });
    await user.click(submitAssignBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('assigned chemist sees "To‘xtatish" button and validates min 5 chars reason', async () => {
    const user = userEvent.setup();
    loginAs('chemist');

    api.onPost('/samples/sample-3/stop').reply(200, {
      data: {
        ...mockSamples[2]!,
        status: 'stopped',
        stopReason: 'Sabab yetarli',
      },
    });

    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('Aspirin xomashyo')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    const sample3Row = rows.find((r) => within(r).queryByText('Aspirin xomashyo'));
    const stopBtn = within(sample3Row!).getByRole('button', { name: /to.?xtatish/i });
    await user.click(stopBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Try submitting with short reason (< 5 chars)
    const reasonInput = within(dialog).getByLabelText(/to.?xtatish sababi/i);
    await user.type(reasonInput, '123');

    const confirmBtn = within(dialog).getByRole('button', { name: /to.?xtatish/i });
    await user.click(confirmBtn);

    expect(
      within(dialog).getByText(/kamida 5 ta belgidan iborat bo'?lishi shart/i),
    ).toBeInTheDocument();

    // Type valid reason >= 5 chars
    await user.type(reasonInput, '45678');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('assigned chemist sees "Davom ettirish" button on stopped sample and resumes', async () => {
    const user = userEvent.setup();
    loginAs('chemist');

    api.onPost('/samples/sample-4/resume').reply(200, {
      data: {
        ...mockSamples[3]!,
        status: 'in_progress',
        stopReason: null,
      },
    });

    renderAt('/samples');

    await waitFor(() => {
      expect(screen.getByText('To‘xtatilgan namuna')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    const sample4Row = rows.find((r) => within(r).queryByText('To‘xtatilgan namuna'));
    const resumeBtn = within(sample4Row!).getByRole('button', { name: /Davom ettirish/i });
    await user.click(resumeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^Davom ettirish$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders SampleDetailPage (/samples/:id) with info, sections, and timeline', async () => {
    loginAs('kontrolyor');
    renderAt('/samples/sample-1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paratsetamol');
    });

    expect(screen.getByText('SN-001')).toBeInTheDocument();
    expect(screen.getByText('LOT-100')).toBeInTheDocument();
    expect(screen.getByText('100 kg')).toBeInTheDocument();
    expect(screen.getByText('Test Zavod')).toBeInTheDocument();

    // Check placeholders and tracking timeline
    expect(screen.getByText('Namuna pasporti')).toBeInTheDocument();
    expect(screen.getByText('Tahlil protokoli')).toBeInTheDocument();
    expect(screen.getByText('Harakatlar tarixi')).toBeInTheDocument();
    expect(screen.getByText('Namuna kiritildi')).toBeInTheDocument();
  });
});
