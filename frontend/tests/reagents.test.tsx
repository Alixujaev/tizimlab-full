import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type {
  ExpenseCalendarDayDto,
  ReagentDocumentDto,
  ReagentDto,
  ReagentExpenseItemDto,
  ReagentTransactionDto,
} from '@/types';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

const now = new Date();
const currentMonthDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`;

const mockReagent: ReagentDto = {
  id: 'reag-1',
  companyId: 'c1',
  name: 'Xlorid kislotasi',
  casNumber: '7647-01-0',
  unit: 'l',
  quantity: 50,
  lowStockThreshold: 10,
  expiresAt: '2027-12-31',
  supplier: 'Sigma Aldrich',
  storageConditions: 'Quruq joyda',
  isHazardous: true,
  isLowStock: false,
  isExpired: false,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const mockTx: ReagentTransactionDto = {
  id: 'tx-1',
  companyId: 'c1',
  reagentId: 'reag-1',
  userId: 'u1',
  userFullName: 'Test Foydalanuvchi',
  type: 'out',
  quantity: 5,
  quantityBefore: 55,
  quantityAfter: 50,
  note: 'Titrlash uchun',
  protocolId: 'proto-1',
  analysisPurpose: 'Tahlil uchun',
  recordedDate: currentMonthDateStr,
  createdAt: `${currentMonthDateStr}T10:00:00.000Z`,
};

const mockDoc: ReagentDocumentDto = {
  id: 'doc-1',
  companyId: 'c1',
  reagentId: 'reag-1',
  docType: 'passport',
  title: 'Sifat pasporti',
  fileId: 'file-1',
  originalName: 'passport.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024 * 500,
  uploadedBy: 'u1',
  uploadedAt: '2026-03-01T00:00:00.000Z',
};

const mockExpenseItem: ReagentExpenseItemDto = {
  id: 'tx-1',
  companyId: 'c1',
  reagentId: 'reag-1',
  reagentName: 'Xlorid kislotasi',
  unit: 'l',
  userId: 'u1',
  userFullName: 'Test Foydalanuvchi',
  quantity: 5,
  recordedDate: currentMonthDateStr,
  note: 'Titrlash uchun',
  protocolId: 'proto-1',
  analysisPurpose: 'Tahlil uchun',
  createdAt: `${currentMonthDateStr}T10:00:00.000Z`,
};

const mockCalendarDay: ExpenseCalendarDayDto = {
  date: currentMonthDateStr,
  totalQuantity: 5,
  itemsCount: 1,
  reagents: [{ id: 'reag-1', name: 'Xlorid kislotasi', quantity: 5, unit: 'l' }],
};

describe('Reagents Frontend (P7: /reagents, /reagents/:id, /reagents/journal, /expenses)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
  });

  afterEach(() => {
    api.restore();
  });

  it('1. /reagents: ro‘yxat yuklanadi, lab_head uchun "+ Yangi reaktiv" ko‘rinadi', async () => {
    loginAs('lab_head');
    api.onGet(/\/reagents/).reply(200, {
      data: [mockReagent],
      meta: { page: 1, limit: 20, total: 1 },
    });

    renderAt('/reagents');

    expect((await screen.findAllByText('Xlorid kislotasi')).length).toBeGreaterThan(0);
    expect(screen.getByText('+ Yangi reaktiv')).toBeInTheDocument();
  });

  it('2. /reagents: chemist roli uchun "+ Yangi reaktiv" ko‘rinmaydi', async () => {
    loginAs('chemist');
    api.onGet(/\/reagents/).reply(200, {
      data: [mockReagent],
      meta: { page: 1, limit: 20, total: 1 },
    });

    renderAt('/reagents');

    expect((await screen.findAllByText('Xlorid kislotasi')).length).toBeGreaterThan(0);
    expect(screen.queryByText('+ Yangi reaktiv')).not.toBeInTheDocument();
  });

  it('3. /reagents/:id: reaktiv tafsilotlari, zaxirasi va tranzaksiyalar tarixi ko‘rsatiladi', async () => {
    loginAs('lab_head');
    api.onGet(/\/reagents\/reag-1$/).reply(200, { data: mockReagent });
    api.onGet(/\/reagents\/reag-1\/transactions/).reply(200, {
      data: [mockTx],
      meta: { page: 1, limit: 15, total: 1 },
    });
    api.onGet(/\/reagents\/reag-1\/documents/).reply(200, { data: [mockDoc] });

    renderAt('/reagents/reag-1');

    expect((await screen.findAllByText('Xlorid kislotasi')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
    expect(screen.getByText('Tahlil uchun')).toBeInTheDocument();
    expect(screen.getByText('+ Tranzaksiya kiritish')).toBeInTheDocument();
  });

  it('4. /reagents/:id: hujjatlar tabiga o‘tganda hujjatlar ro‘yxati ko‘rsatiladi va yuklab olish mavjud', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    api.onGet(/\/reagents\/reag-1$/).reply(200, { data: mockReagent });
    api.onGet(/\/reagents\/reag-1\/transactions/).reply(200, {
      data: [],
      meta: { page: 1, limit: 15, total: 0 },
    });
    api.onGet(/\/reagents\/reag-1\/documents/).reply(200, { data: [mockDoc] });

    renderAt('/reagents/reag-1');

    const docsTab = await screen.findByRole('button', { name: /Reaktiv hujjatlari/ });
    await user.click(docsTab);

    expect(await screen.findByText('Sifat pasporti')).toBeInTheDocument();
    expect(screen.getByText(/passport\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('Yuklab olish')).toBeInTheDocument();
  });

  it('5. /reagents/journal: oylik kalendar jurnali sarf-xarajatlarni ko‘rsatadi', async () => {
    loginAs('chemist');
    api.onGet(/\/reagents\/expenses\/calendar/).reply(200, { data: [mockCalendarDay] });

    renderAt('/reagents/journal');

    expect(await screen.findByRole('heading', { level: 1, name: /Xarajat jurnali/ })).toBeInTheDocument();
    expect(await screen.findByText('1 ta chiqim')).toBeInTheDocument();
  });

  it('6. /expenses: xarajatlar ro‘yxati jadvali chiqimlarni to‘g‘ri aks ettiradi', async () => {
    loginAs('kontrolyor');
    api.onGet(/\/expenses/).reply(200, {
      data: [mockExpenseItem],
      meta: { page: 1, limit: 20, total: 1 },
    });

    renderAt('/expenses');

    expect(await screen.findByRole('heading', { level: 1, name: /Xarajat/ })).toBeInTheDocument();
    expect((await screen.findAllByText('Xlorid kislotasi')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Titrlash uchun/)).toBeInTheDocument();
  });
});
