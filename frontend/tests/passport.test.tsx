import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import uz from '@/i18n/locales/uz.json';
import type { Role, SampleDetailDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

const P = uz.samples.passport;
let api: MockAdapter;

function sample(over: Partial<SampleDetailDto> = {}): SampleDetailDto {
  return {
    id: 's1',
    companyId: 'c1',
    type: 'reagent',
    status: 'pending_assignment',
    substanceId: null,
    substanceName: 'Natriy xlorid',
    serialNumber: null,
    lotNumber: 'LOT-1',
    quantity: null,
    manufacturer: null,
    manufacturedAt: null,
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
    passportFileName: null,
    passportStatus: null,
    passportUploadedBy: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    tracking: [],
    ...over,
  };
}

const withPassport = (status: 'pending' | 'approved' | 'rejected' | null, by = 'u2') => ({
  passportFileName: 'pasport.pdf',
  passportStatus: status,
  passportUploadedBy: by,
});

async function open(role: Role, s: SampleDetailDto) {
  api.onGet('/samples/s1').reply(200, { data: s });
  loginAs(role);
  renderAt('/samples/s1');
  return screen.findByRole('heading', { name: uz.samples.passportTitle });
}

const pdf = () => new File(['%PDF-1.7'], 'pasport.pdf', { type: 'application/pdf' });
const section = () => screen.getByRole('region', { name: uz.samples.passportTitle });

describe('PassportSection: rol va tur bo‘yicha ko‘rinish', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
    vi.restoreAllMocks();
  });

  it('reagent + lab_head: "yagona yo‘l" matni, avto-tasdiq izohi va yuklash', async () => {
    await open('lab_head', sample());
    expect(within(section()).getByText(P.approvalFlowNotice)).toBeInTheDocument();
    expect(within(section()).getByText(P.autoApproveNotice)).toBeInTheDocument();
    expect(screen.getByLabelText(P.fileInputLabel)).toBeInTheDocument();
  });

  it('reagent + kontrolyor: pending izohi; yuklash POST multipart', async () => {
    api.onPost('/samples/s1/passport').reply(201, { data: sample(withPassport('pending', 'u1')) });
    await open('kontrolyor', sample());
    expect(within(section()).getByText(P.pendingNotice)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText(P.fileInputLabel), pdf());
    await waitFor(() => expect(api.history.post).toHaveLength(1));
    expect(api.history.post[0]!.data).toBeInstanceOf(FormData);
    expect((api.history.post[0]!.data as FormData).get('file')).toBeInstanceOf(File);
  });

  it('director: yuklash va o‘chirish yo‘q, faqat yuklab olish', async () => {
    await open('director', sample(withPassport('pending')));
    expect(screen.queryByLabelText(P.fileInputLabel)).not.toBeInTheDocument();
    expect(within(section()).getByRole('button', { name: P.download })).toBeInTheDocument();
    expect(within(section()).queryByRole('button', { name: P.delete })).not.toBeInTheDocument();
    expect(within(section()).queryByRole('button', { name: P.approve })).not.toBeInTheDocument();
  });

  it('lab_head boshqaning pending pasportini tasdiqlaydi', async () => {
    api.onPost('/samples/s1/passport/review').reply(200, { data: sample({ status: 'approved' }) });
    await open('lab_head', sample(withPassport('pending', 'u2')));
    expect(within(section()).getByTestId('passport-status')).toHaveTextContent(
      uz.samples.passportStatus.pending,
    );
    await userEvent.click(within(section()).getByRole('button', { name: P.approve }));
    await waitFor(() => expect(api.history.post).toHaveLength(1));
    expect(JSON.parse(api.history.post[0]!.data as string)).toEqual({ decision: 'approve' });
  });

  it('o‘zi yuklagan pasportda tasdiqlash tugmalari yashirin', async () => {
    await open('lab_head', sample(withPassport('pending', 'u1')));
    expect(within(section()).queryByRole('button', { name: P.approve })).not.toBeInTheDocument();
    expect(within(section()).queryByRole('button', { name: P.reject })).not.toBeInTheDocument();
    expect(within(section()).getByText(P.ownPassportNotice)).toBeInTheDocument();
  });

  it('kontrolyor ko‘rib chiqa olmaydi', async () => {
    await open('kontrolyor', sample(withPassport('pending', 'u2')));
    expect(within(section()).queryByRole('button', { name: P.approve })).not.toBeInTheDocument();
  });

  it('rad etish modali: sabab <5 belgi xato, ≥5 belgi yuboriladi', async () => {
    api
      .onPost('/samples/s1/passport/review')
      .reply(200, { data: sample(withPassport('rejected')) });
    await open('admin', sample(withPassport('pending', 'u2')));
    await userEvent.click(within(section()).getByRole('button', { name: P.reject }));
    const dialog = await screen.findByRole('dialog', { name: P.rejectTitle });
    await userEvent.type(within(dialog).getByLabelText(P.rejectReason), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: P.reject }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(P.rejectReasonMin);
    expect(api.history.post).toHaveLength(0);

    await userEvent.type(within(dialog).getByLabelText(P.rejectReason), ' — muddati o‘tgan');
    await userEvent.click(within(dialog).getByRole('button', { name: P.reject }));
    await waitFor(() => expect(api.history.post).toHaveLength(1));
    expect(JSON.parse(api.history.post[0]!.data as string)).toEqual({
      decision: 'reject',
      reason: 'abc — muddati o‘tgan',
    });
  });

  it('rad etilgan pasport sababi ko‘rsatiladi, yuklagan foydalanuvchi qayta yuklay oladi', async () => {
    await open(
      'kontrolyor',
      sample({
        ...withPassport('rejected', 'u1'),
        tracking: [
          {
            id: 't1',
            sampleId: 's1',
            eventType: 'passport_reviewed',
            userId: 'u2',
            fromStatus: 'pending_assignment',
            toStatus: 'pending_assignment',
            reason: 'Sertifikat yaroqsiz',
            metadata: { decision: 'reject' },
            createdAt: '2026-03-02T10:00:00.000Z',
          },
        ],
      }),
    );
    expect(within(section()).getByText(/Sertifikat yaroqsiz/)).toBeInTheDocument();
    expect(screen.getByLabelText(P.fileInputLabel)).toBeInTheDocument();
  });

  it('raw_material: qo‘shimcha hujjat matni; biriktirilmagan chemist yuklay olmaydi', async () => {
    await open(
      'chemist',
      sample({ type: 'raw_material', status: 'in_progress', assignedTo: 'other' }),
    );
    expect(within(section()).getByText(P.attachmentNotice)).toBeInTheDocument();
    expect(screen.queryByLabelText(P.fileInputLabel)).not.toBeInTheDocument();
  });

  it('raw_material: biriktirilgan chemist yuklay oladi', async () => {
    await open(
      'chemist',
      sample({ type: 'raw_material', status: 'in_progress', assignedTo: 'u1' }),
    );
    expect(screen.getByLabelText(P.fileInputLabel)).toBeInTheDocument();
    expect(within(section()).queryByText(P.autoApproveNotice)).not.toBeInTheDocument();
  });

  it('other turida pasport bo‘limi ko‘rsatilmaydi', async () => {
    api.onGet('/samples/s1').reply(200, { data: sample({ type: 'other' }) });
    loginAs('lab_head');
    renderAt('/samples/s1');
    await screen.findByRole('heading', { name: uz.samples.timelineTitle });
    expect(
      screen.queryByRole('heading', { name: uz.samples.passportTitle }),
    ).not.toBeInTheDocument();
  });
});

describe('PassportSection: yuklash xatolari, o‘chirish, yuklab olish', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });
  afterEach(() => {
    api.restore();
    resetAuth();
    vi.restoreAllMocks();
  });

  it('mijoz tekshiruvi: noto‘g‘ri format va 20MB dan katta fayl serverga yuborilmaydi', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await open('lab_head', sample());
    await user.upload(screen.getByLabelText(P.fileInputLabel), new File(['x'], 'a.txt'));
    expect(within(section()).getByRole('alert')).toHaveTextContent(P.fileErrors.unsupported);

    const big = pdf();
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
    await user.upload(screen.getByLabelText(P.fileInputLabel), big);
    expect(within(section()).getByRole('alert')).toHaveTextContent(P.fileErrors.tooLarge);
    expect(api.history.post).toHaveLength(0);
  });

  it.each([
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [422, 'EMPTY_FILE'],
    [503, 'STORAGE_UNAVAILABLE'],
    [409, 'PASSPORT_EXISTS'],
  ] as const)('server %i %s xatosi tarjima qilingan holda ko‘rsatiladi', async (status, code) => {
    api.onPost('/samples/s1/passport').reply(status, { error: { code, message: 'server xabari' } });
    await open('lab_head', sample());
    await userEvent.upload(screen.getByLabelText(P.fileInputLabel), pdf());
    expect(await within(section()).findByRole('alert')).toHaveTextContent(uz.errors.codes[code]);
  });

  it('egasi pending pasportni tasdiqlash modali orqali o‘chiradi', async () => {
    api.onDelete('/samples/s1/passport').reply(200, { data: sample() });
    await open('kontrolyor', sample(withPassport('pending', 'u1')));
    await userEvent.click(within(section()).getByRole('button', { name: P.delete }));
    const dialog = await screen.findByRole('dialog', { name: P.deleteTitle });
    expect(within(dialog).queryByText(P.deleteApprovedWarning)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: P.delete }));
    await waitFor(() => expect(api.history.delete).toHaveLength(1));
  });

  it('tasdiqlangan pasport: egasi o‘chira olmaydi', async () => {
    await open('kontrolyor', sample({ ...withPassport('approved', 'u1'), status: 'approved' }));
    expect(within(section()).queryByRole('button', { name: P.delete })).not.toBeInTheDocument();
  });

  it('lab_head tasdiqlangan pasportni o‘chirishda ogohlantirish ko‘radi', async () => {
    await open('lab_head', sample({ ...withPassport('approved', 'u2'), status: 'approved' }));
    await userEvent.click(within(section()).getByRole('button', { name: P.delete }));
    const dialog = await screen.findByRole('dialog', { name: P.deleteTitle });
    expect(within(dialog).getByText(P.deleteApprovedWarning)).toBeInTheDocument();
  });

  it('yuklab olish: imzolangan URL olinib yangi oynada ochiladi', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    api
      .onGet('/samples/s1/passport/download')
      .reply(200, { data: { url: 'https://r2.example/signed', expiresIn: 300 } });
    await open('director', sample(withPassport('approved')));
    await userEvent.click(within(section()).getByRole('button', { name: P.download }));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://r2.example/signed',
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });
});
