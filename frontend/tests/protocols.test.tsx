import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import uz from '@/i18n/locales/uz.json';
import type { ProtocolDetailDto, SampleDetailDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

let api: MockAdapter;

function createSample(over: Partial<SampleDetailDto> = {}): SampleDetailDto {
  return {
    id: 's1',
    companyId: 'c1',
    type: 'raw_material',
    status: 'in_progress',
    substanceId: null,
    substanceName: 'Amoksitsillin',
    serialNumber: 'SN-01',
    lotNumber: 'LOT-01',
    quantity: '10 kg',
    manufacturer: 'PharmaCo',
    manufacturedAt: null,
    analysisStart: null,
    analysisEnd: null,
    notes: null,
    createdBy: 'u1',
    assignedTo: 'u1',
    assignedBy: 'u2',
    assignedAt: '2026-03-01T10:00:00.000Z',
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    passportFileName: null,
    passportStatus: null,
    passportUploadedBy: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    tracking: [],
    ...over,
  };
}

function createProtocol(over: Partial<ProtocolDetailDto> = {}): ProtocolDetailDto {
  return {
    id: 'p1',
    companyId: 'c1',
    sampleId: 's1',
    createdBy: 'u2',
    createdByName: 'Mudir',
    status: 'draft',
    protocolRole: 'standard',
    filePath: null,
    fileName: null,
    fileSize: null,
    fileMime: null,
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
  };
}

describe('Protocols frontend component (ProtocolSection & workflows)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAuth();
    api = new MockAdapter(apiClient);
  });

  afterEach(() => {
    api.restore();
  });

  it('biriktirilmagan namunada kutish xabari ko‘rsatiladi', async () => {
    const s = createSample({ status: 'pending_assignment', assignedTo: null });
    api.onGet('/samples/s1').reply(200, { data: s });
    api.onGet('/protocols/sample/s1').reply(200, { data: [] });

    loginAs('chemist');
    renderAt('/samples/s1');

    expect(await screen.findByText(uz.protocols.pendingAssignmentNotice)).toBeInTheDocument();
  });

  it('kimyogar uchun faylsiz draft protokolida Yuborish tugmasi nofaol (disabled) bo‘ladi', async () => {
    const s = createSample();
    const p = createProtocol();

    api.onGet('/samples/s1').reply(200, { data: s });
    api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
    api.onGet('/protocols/p1').reply(200, { data: p });

    loginAs('chemist');
    renderAt('/samples/s1');

    const submitBtn = await screen.findByRole('button', { name: uz.protocols.submit });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(uz.protocols.fileMissing)).toBeInTheDocument();
  });

  it('fayl biriktirilgan protokolni kimyogar yubora oladi (submit)', async () => {
    const s = createSample();
    const p = createProtocol({
      filePath: 'c1/protocols/p1/file.pdf',
      fileName: 'analiz_natijasi.pdf',
      fileSize: 1024 * 1024,
      fileMime: 'application/pdf',
    });

    api.onGet('/samples/s1').reply(200, { data: s });
    api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
    api.onGet('/protocols/p1').reply(200, { data: p });
    api.onPost('/protocols/p1/submit').reply(200, {
      data: { ...p, status: 'submitted' },
    });

    loginAs('chemist');
    renderAt('/samples/s1');

    const submitBtn = await screen.findByRole('button', { name: uz.protocols.submit });
    expect(submitBtn).toBeEnabled();

    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.history.post.some((req) => req.url === '/protocols/p1/submit')).toBe(true);
    });
  });

  it('lab_head yuborilgan (submitted) protokolni tasdiqlashi (approve) mumkin', async () => {
    const s = createSample({ status: 'submitted' });
    const p = createProtocol({
      status: 'submitted',
      filePath: 'c1/protocols/p1/file.pdf',
      fileName: 'analiz_natijasi.pdf',
    });

    api.onGet('/samples/s1').reply(200, { data: s });
    api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
    api.onGet('/protocols/p1').reply(200, { data: p });
    api.onPost('/protocols/p1/approve').reply(200, {
      data: { ...p, status: 'approved' },
    });

    loginAs('lab_head');
    renderAt('/samples/s1');

    const approveBtn = await screen.findByRole('button', { name: uz.protocols.approve });
    expect(approveBtn).toBeInTheDocument();

    await userEvent.click(approveBtn);

    await waitFor(() => {
      expect(api.history.post.some((req) => req.url === '/protocols/p1/approve')).toBe(true);
    });
  });

  it('lab_head rad etish tugmasini bosganda modal ochiladi, sabab min 5 belgi tekshiriladi (D-122)', async () => {
    const s = createSample({ status: 'submitted' });
    const p = createProtocol({
      status: 'submitted',
      filePath: 'c1/protocols/p1/file.pdf',
      fileName: 'analiz_natijasi.pdf',
    });

    api.onGet('/samples/s1').reply(200, { data: s });
    api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
    api.onGet('/protocols/p1').reply(200, { data: p });
    api.onPost('/protocols/p1/reject').reply(200, {
      data: { ...p, status: 'rejected', rejectionReason: 'Spektr qiymatlari mos emas' },
    });

    loginAs('lab_head');
    renderAt('/samples/s1');

    const rejectBtn = await screen.findByRole('button', { name: uz.protocols.reject });
    await userEvent.click(rejectBtn);

    // Modal sarlavhasi
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const modal = screen.getByRole('dialog');
    const textarea = within(modal).getByRole('textbox');
    const confirmBtn = within(modal).getByRole('button', { name: uz.protocols.rejectConfirm });

    // Qisqa sabab yozilganda tasdiqlash tugmasi nofaol
    await userEvent.type(textarea, 'kam');
    expect(confirmBtn).toBeDisabled();

    // 5 belgidan oshganda tugma faollashadi
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Spektr qiymatlari mos emas');
    expect(confirmBtn).toBeEnabled();

    await userEvent.click(confirmBtn);

    await waitFor(() => {
      const call = api.history.post.find((req) => req.url === '/protocols/p1/reject');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data as string)).toEqual({
        reason: 'Spektr qiymatlari mos emas',
      });
    });
  });

  it('direktor reyestr tafsilotlarida (RegistryDetailPage) protokolni yakunlashi (finalize) mumkin (R-REG-17, D-50)', async () => {
    const s = createSample({ status: 'approved' });
    const p = createProtocol({
      status: 'approved',
      filePath: 'c1/protocols/p1/file.pdf',
      fileName: 'analiz_natijasi.pdf',
    });

    api.onGet('/registry/s1').reply(200, {
      data: {
        ...s,
        approvedAt: '2026-03-02T10:00:00.000Z',
        downloadKind: 'protocol',
      },
    });
    api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
    api.onPost('/protocols/p1/finalize').reply(200, {
      data: { ...p, status: 'finalized' },
    });

    loginAs('director');
    renderAt('/registry/s1');

    const finalizeBtn = await screen.findByRole('button', { name: uz.protocols.finalize });
    expect(finalizeBtn).toBeInTheDocument();

    await userEvent.click(finalizeBtn);

    await waitFor(() => {
      expect(api.history.post.some((req) => req.url === '/protocols/p1/finalize')).toBe(true);
    });
  });

  it('imzolar tarixi ro‘yxatda ko‘rsatiladi (foydalanuvchi, rol, harakat, hash)', async () => {
    const s = createSample();
    const p = createProtocol({
      signatures: [
        {
          id: 'sig-1',
          userId: 'chemist-user-id',
          userFullName: 'Kimyogar Ali',
          role: 'chemist',
          action: 'submitted',
          signatureHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          ipAddress: '127.0.0.1',
          signedAt: '2026-03-01T12:00:00.000Z',
        },
      ],
    });

    api.onGet('/samples/s1').reply(200, { data: s });
    api.onGet('/protocols/sample/s1').reply(200, { data: [p] });
    api.onGet('/protocols/p1').reply(200, { data: p });

    loginAs('chemist');
    renderAt('/samples/s1');

    expect(await screen.findByText('Kimyogar Ali')).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
  });
});
