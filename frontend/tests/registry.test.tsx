import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import uz from '@/i18n/locales/uz.json';
import { formatDate, parseDisplayDate } from '@/lib/date';
import type { RegistryDetailDto, RegistryItemDto, Role } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

const R = uz.registry;
let api: MockAdapter;

function item(over: Partial<RegistryItemDto> = {}): RegistryItemDto {
  return {
    id: 'r1',
    companyId: 'c1',
    type: 'reagent',
    status: 'approved',
    substanceId: null,
    substanceName: 'Natriy xlorid',
    serialNumber: 'SER-1',
    lotNumber: 'LOT-1',
    quantity: '1 kg',
    manufacturer: null,
    manufacturedAt: null,
    analysisStart: null,
    analysisEnd: null,
    notes: null,
    createdBy: 'u2',
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    passportFileName: 'pasport.pdf',
    passportStatus: 'approved',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    approvedAt: '2026-03-05T10:00:00.000Z',
    downloadKind: 'passport',
    ...over,
  };
}

const rows = [
  item(),
  item({
    id: 'r2',
    type: 'finished_product',
    substanceName: 'Paratsetamol',
    downloadKind: 'protocol',
  }),
  item({ id: 'r3', type: 'raw_material', substanceName: 'Ibuprofen', downloadKind: null }),
];

const detail: RegistryDetailDto = { ...item(), tracking: [] };

beforeEach(() => {
  api = new MockAdapter(apiClient);
  api.onGet('/registry').reply(200, { data: rows, meta: { page: 1, limit: 20, total: 3 } });
  api.onGet('/registry/r1').reply(200, { data: detail });
});
afterEach(() => {
  api.restore();
  resetAuth();
  vi.restoreAllMocks();
});

async function openList(role: Role) {
  loginAs(role);
  const utils = renderAt('/registry');
  await screen.findByText('Natriy xlorid');
  return utils;
}

const lastParams = () => api.history.get.filter((r) => r.url === '/registry').at(-1)!.params;

describe('lib/date (D-110)', () => {
  it('DD.MM.YYYY ↔ ISO', () => {
    expect(formatDate('2026-03-05')).toBe('05.03.2026');
    expect(parseDisplayDate('05.03.2026')).toBe('2026-03-05');
    expect(parseDisplayDate('31.02.2026')).toBeNull();
    expect(parseDisplayDate('2026-03-05')).toBeNull();
    expect(formatDate(null)).toBe('—');
  });
});

describe('/registry (R-FE-26)', () => {
  it('sarlavha, qatorlar, tasdiqlangan sana DD.MM.YYYY va yuklab olish turlari', async () => {
    await openList('kontrolyor');
    expect(screen.getByRole('heading', { name: uz.pages.registry })).toBeInTheDocument();
    expect(screen.getAllByText('05.03.2026').length).toBeGreaterThan(0);
    const r1 = screen.getByText('Natriy xlorid').closest('tr')!;
    expect(within(r1).getByRole('button', { name: R.downloadPassport })).toBeInTheDocument();
    const r2 = screen.getByText('Paratsetamol').closest('tr')!;
    expect(within(r2).getByRole('button', { name: R.downloadProtocol })).toBeInTheDocument();
    const r3 = screen.getByText('Ibuprofen').closest('tr')!;
    expect(within(r3).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Natriy xlorid' })).toHaveAttribute(
      'href',
      '/registry/r1',
    );
  });

  it('filtrlar ISO formatida API ga yuboriladi (har biri va birgalikda)', async () => {
    await openList('chemist');
    await userEvent.selectOptions(screen.getByLabelText(R.filters.type), 'finished_product');
    await userEvent.type(screen.getByLabelText(R.filters.substanceName), 'Parats');
    await userEvent.type(screen.getByLabelText(R.filters.serialNumber), 'SER');
    await userEvent.type(screen.getByLabelText(R.filters.lotNumber), 'LOT-1');
    await userEvent.type(screen.getByLabelText(R.filters.approvedFrom), '01.03.2026');
    await userEvent.type(screen.getByLabelText(R.filters.approvedTo), '31.03.2026');
    await userEvent.click(screen.getByRole('button', { name: R.filters.apply }));
    await waitFor(() =>
      expect(lastParams()).toEqual({
        page: 1,
        type: 'finished_product',
        substanceName: 'Parats',
        serialNumber: 'SER',
        lotNumber: 'LOT-1',
        approvedFrom: '2026-03-01',
        approvedTo: '2026-03-31',
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: R.filters.reset }));
    // Boshlang'ich so'rov keshda — qayta yuklanmaydi, forma tozalanadi
    expect(screen.getByLabelText(R.filters.lotNumber)).toHaveValue('');
    expect(screen.getByLabelText(R.filters.approvedFrom)).toHaveValue('');
    expect(await screen.findByText('Ibuprofen')).toBeInTheDocument();
  });

  it('noto‘g‘ri sana va oraliq — xato, so‘rov yuborilmaydi', async () => {
    await openList('director');
    const before = api.history.get.length;
    await userEvent.type(screen.getByLabelText(R.filters.approvedFrom), '2026-03-01');
    await userEvent.click(screen.getByRole('button', { name: R.filters.apply }));
    expect(screen.getByRole('alert')).toHaveTextContent(R.filters.invalidDate);

    await userEvent.clear(screen.getByLabelText(R.filters.approvedFrom));
    await userEvent.type(screen.getByLabelText(R.filters.approvedFrom), '10.04.2026');
    await userEvent.type(screen.getByLabelText(R.filters.approvedTo), '01.04.2026');
    await userEvent.click(screen.getByRole('button', { name: R.filters.apply }));
    expect(screen.getByRole('alert')).toHaveTextContent(R.filters.invalidRange);
    expect(api.history.get.length).toBe(before);
  });

  it.each([
    ['lab_head', true],
    ['admin', true],
    ['kontrolyor', false],
    ['chemist', false],
    ['director', false],
  ] as [Role, boolean][])('%s: o‘chirish tugmasi ko‘rinadi = %s', async (role, visible) => {
    await openList(role);
    expect(screen.queryAllByRole('button', { name: R.delete }).length > 0).toBe(visible);
  });

  it('o‘chirish tasdiqlash modali orqali DELETE /registry/:id', async () => {
    api.onDelete('/registry/r1').reply(204);
    await openList('lab_head');
    const r1 = screen.getByText('Natriy xlorid').closest('tr')!;
    await userEvent.click(within(r1).getByRole('button', { name: R.delete }));
    const dialog = await screen.findByRole('dialog', { name: R.deleteTitle });
    expect(dialog).toHaveTextContent('Natriy xlorid');
    await userEvent.click(within(dialog).getByRole('button', { name: R.confirmDelete }));
    await waitFor(() => expect(api.history.delete.map((r) => r.url)).toEqual(['/registry/r1']));
  });

  it('yuklab olish: imzolangan URL yangi oynada; 404 bo‘lsa xato toast', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const toastSpy = vi.spyOn(toast, 'error');
    api
      .onGet('/registry/r1/download')
      .reply(200, { data: { url: 'https://r2.example/x', expiresIn: 300 } });
    api
      .onGet('/registry/r2/download')
      .reply(404, { error: { code: 'FILE_NOT_FOUND', message: 'x' } });
    await openList('kontrolyor');
    await userEvent.click(screen.getByRole('button', { name: R.downloadPassport }));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith('https://r2.example/x', '_blank', 'noopener,noreferrer'),
    );
    await userEvent.click(screen.getByRole('button', { name: R.downloadProtocol }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(uz.errors.codes.FILE_NOT_FOUND));
  });
});

describe('/registry/:id (R-FE-27)', () => {
  it('tafsilot, yuklab olish; lab_head o‘chirgach /registry ga qaytadi', async () => {
    api.onDelete('/registry/r1').reply(204);
    loginAs('lab_head');
    const { router } = renderAt('/registry/r1');
    expect(await screen.findByRole('heading', { name: 'Natriy xlorid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: R.downloadPassport })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: uz.samples.timelineTitle })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: R.delete }));
    const dialog = await screen.findByRole('dialog', { name: R.deleteTitle });
    await userEvent.click(within(dialog).getByRole('button', { name: R.confirmDelete }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/registry'));
  });

  it('kontrolyor uchun o‘chirish tugmasi yo‘q', async () => {
    loginAs('kontrolyor');
    renderAt('/registry/r1');
    await screen.findByRole('heading', { name: 'Natriy xlorid' });
    expect(screen.queryByRole('button', { name: R.delete })).not.toBeInTheDocument();
  });

  it('mavjud bo‘lmagan namuna — "topilmadi"', async () => {
    api.onGet('/registry/missing').reply(404, { error: { code: 'NOT_FOUND', message: 'x' } });
    loginAs('chemist');
    renderAt('/registry/missing');
    expect(await screen.findByRole('heading', { name: R.notFound })).toBeInTheDocument();
  });
});
