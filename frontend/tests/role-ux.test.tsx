import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import { createQueryClient, errorMessage, resolveForbiddenMessage } from '@/lib/queryClient';
import type { Role, SampleDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

let api: MockAdapter;

const mockSamples: SampleDto[] = [
  {
    id: 'sample-1',
    companyId: 'c1',
    type: 'raw_material',
    status: 'in_progress',
    substanceId: 'sub-1',
    substanceName: 'Paratsetamol',
    serialNumber: 'SN-001',
    lotNumber: 'LOT-100',
    quantity: '100 kg',
    manufacturer: 'Test Zavod',
    manufacturedAt: '2026-01-01',
    analysisStart: '2026-01-02',
    analysisEnd: '2026-01-10',
    notes: null,
    createdBy: 'u1',
    assignedTo: 'chemist-uuid-1234',
    assignedToName: 'Aziz Kimyogar',
    assigned_to_name: 'Aziz Kimyogar',
    assignedBy: 'u2',
    assignedAt: '2026-01-01T12:00:00.000Z',
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'sample-2',
    companyId: 'c1',
    type: 'raw_material',
    status: 'pending_assignment',
    substanceId: 'sub-1',
    substanceName: 'Aspirin',
    serialNumber: 'SN-002',
    lotNumber: 'LOT-200',
    quantity: '50 kg',
    manufacturer: 'Test Zavod',
    manufacturedAt: '2026-01-01',
    analysisStart: null,
    analysisEnd: null,
    notes: null,
    createdBy: 'u1',
    assignedTo: null,
    assignedToName: null,
    assigned_to_name: null,
    assignedBy: null,
    assignedAt: null,
    stopReason: null,
    stoppedAt: null,
    deletedAt: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
];

describe('Role-aware requests & 403 UX (Fix role-403-ux)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api = new MockAdapter(apiClient);
    await i18n.changeLanguage('uz');

    api.onGet('/notifications/unread-count').reply(200, { data: 0 });
    api.onGet(/\/notifications/).reply(200, { data: [], meta: { page: 1, limit: 10, total: 0 } });
    api.onGet('/substances').reply(200, { data: [], meta: { page: 1, limit: 100, total: 0 } });
    api.onGet('/samples').reply(200, { data: mockSamples, meta: { page: 1, limit: 20, total: 2 } });
    api.onGet('/samples/sample-1').reply(200, {
      data: {
        ...mockSamples[0],
        tracking: [],
      },
    });
    api.onGet(/\/protocols\/sample\//).reply(200, { data: [] });
    api.onGet(/\/protocols\//).reply(200, { data: [] });

    // Agar ruxsatsiz rol /admin/users ni chaqirsa, backend 403 qaytaradi
    api.onGet(/\/admin\/users/).reply(403, {
      error: {
        code: 'FORBIDDEN',
        message: "Bu amal uchun ruxsat yo'q",
        details: { resource: 'users', action: 'view' },
      },
    });
  });

  afterEach(() => {
    api.restore();
    resetAuth();
  });

  describe('1. Har rol uchun sahifa ochilganda 403 so‘rov yo‘qligi', () => {
    const roles: Role[] = ['kontrolyor', 'chemist', 'lab_head', 'director', 'admin'];

    for (const role of roles) {
      it(`${role} rolida /samples ochilganda /admin/users ga ruxsatsiz 403 so'rov ketmaydi va toast chiqmaydi`, async () => {
        loginAs(role);
        renderAt('/samples');

        await waitFor(() => {
          expect(screen.getByText('Paratsetamol')).toBeInTheDocument();
        });

        // /admin/users ga so'rov ketmagan bo'lishi kerak (yoki 403 beruvchi so'rov yo'q)
        const userRequests = api.history.get.filter((r) => r.url?.includes('/admin/users'));
        expect(userRequests).toHaveLength(0);

        // Sahifa yuklanishida hech qanday xato toast'i chiqmagan
        expect(toast.error).not.toHaveBeenCalled();
      });

      it(`${role} rolida /samples/sample-1 ochilganda /admin/users ga 403 so'rov ketmaydi`, async () => {
        loginAs(role);
        renderAt('/samples/sample-1');

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Paratsetamol' })).toBeInTheDocument();
        });

        const userRequests = api.history.get.filter((r) => r.url?.includes('/admin/users'));
        expect(userRequests).toHaveLength(0);
        expect(toast.error).not.toHaveBeenCalled();
      });
    }
  });

  describe('2. Namunalar jadvalida kimyogar ismi ko‘rsatilishi (UUID emas)', () => {
    it('biriktirilgan namunada kimyogar ismi ("Aziz Kimyogar") ko‘rsatiladi, UUID emas', async () => {
      loginAs('kontrolyor');
      renderAt('/samples');

      await waitFor(() => {
        expect(screen.getByText('Aziz Kimyogar')).toBeInTheDocument();
      });

      // UUID ko'rinmasligi kerak
      expect(screen.queryByText('chemist-uuid-1234')).not.toBeInTheDocument();
    });

    it('biriktirilmagan namunada tire ("—") ko‘rsatiladi', async () => {
      loginAs('kontrolyor');
      renderAt('/samples');

      await waitFor(() => {
        expect(screen.getByText('Aspirin')).toBeInTheDocument();
      });

      // Biriktirilmagan qatorda "—" chiqadi
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('namuna tafsilotlari sahifasida ham kimyogar ismi ko‘rinadi', async () => {
      loginAs('chemist');
      renderAt('/samples/sample-1');

      await waitFor(() => {
        expect(screen.getByText('Aziz Kimyogar')).toBeInTheDocument();
      });
      expect(screen.queryByText('chemist-uuid-1234')).not.toBeInTheDocument();
    });
  });

  describe('3. Global 403 toast matni va so‘rovlar filtri', () => {
    it('uz tilida qaysi resurs/amal uchun ruxsat yo‘qligi ma‘lumotli ko‘rsatiladi', () => {
      const msgSamplesView = resolveForbiddenMessage(null, {
        code: 'FORBIDDEN',
        message: "Bu amal uchun ruxsat yo'q",
        details: { resource: 'samples', action: 'view' },
      });
      expect(msgSamplesView).toBe("Namunalar ro'yxatini ko'rish uchun ruxsat yo'q");

      const msgUsersView = resolveForbiddenMessage(null, {
        code: 'FORBIDDEN',
        message: "Bu amal uchun ruxsat yo'q",
        details: { resource: 'users', action: 'view' },
      });
      expect(msgUsersView).toBe("Foydalanuvchilar ro'yxatini ko'rish uchun ruxsat yo'q");

      const msgSamplesAssign = resolveForbiddenMessage(null, {
        code: 'FORBIDDEN',
        message: "Bu amal uchun ruxsat yo'q",
        details: { resource: 'samples', action: 'assign' },
      });
      expect(msgSamplesAssign).toBe("Namunani biriktirish uchun ruxsat yo'q");
    });

    it('ru va en tillarida ham to‘g‘ri tarjimalar chiqadi', async () => {
      await i18n.changeLanguage('ru');
      const ruMsg = resolveForbiddenMessage(null, {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        details: { resource: 'samples', action: 'view' },
      });
      expect(ruMsg).toBe('Нет прав на просмотр списка образцов');

      await i18n.changeLanguage('en');
      const enMsg = resolveForbiddenMessage(null, {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        details: { resource: 'samples', action: 'view' },
      });
      expect(enMsg).toBe('No permission to view samples list');
    });

    it('URL orqali ham resurs va amal aniqlanadi', async () => {
      await i18n.changeLanguage('uz');
      const axiosErr = {
        isAxiosError: true,
        response: { status: 403 },
        config: { url: '/api/v1/samples/123/assign', method: 'post' },
      };
      expect(errorMessage(axiosErr)).toBe("Namunani biriktirish uchun ruxsat yo'q");
    });

    it('queryCache da sahifa yuklanishida avtomatik so‘rov xato bersa ham toast chiqmaydi', () => {
      const client = createQueryClient();
      const onError = client.getQueryCache().config.onError;
      if (onError) {
        onError(new Error('403') as never, { meta: {} } as never);
      }
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('mutationCache da foydalanuvchi amali 403 bersa, ma‘lumotli toast chiqadi', () => {
      const client = createQueryClient();
      const onError = client.getMutationCache().config.onError;
      const error = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error: {
              code: 'FORBIDDEN',
              message: "Bu amal uchun ruxsat yo'q",
              details: { resource: 'samples', action: 'assign' },
            },
          },
        },
      };

      if (onError) {
        onError(error as never, undefined, undefined, { meta: {} } as never, undefined as never);
      }
      expect(toast.error).toHaveBeenCalledWith("Namunani biriktirish uchun ruxsat yo'q");
    });
  });
});
