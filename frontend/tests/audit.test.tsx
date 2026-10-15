import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { AuditLogDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

let api: MockAdapter;

const mockAuditLog: AuditLogDto = {
  id: 'log-1',
  userId: 'u1',
  userFullName: 'Test Foydalanuvchi',
  userEmail: 'admin@test.uz',
  companyId: 'c1',
  companyName: 'Test Lab',
  action: 'create',
  tableName: 'samples',
  recordId: 'sample-1234',
  oldValues: null,
  newValues: { name: 'Yangi Namuna', code: 'SMP-001' },
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0 Test',
  createdAt: '2026-04-01T12:00:00.000Z',
};

describe('Audit and Activity Logs UI (P10, D-147)', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    resetAuth();
  });

  afterEach(() => {
    api.restore();
    cleanup();
    resetAuth();
  });

  describe('/logs (AuditLogPage)', () => {
    it('super_admin audit jurnali sahifasini ko‘radi va loglar ro‘yxati chiqadi', async () => {
      loginAs('super_admin');
      api.onGet(/\/audit/).reply(200, {
        data: [mockAuditLog],
        meta: { page: 1, limit: 15, total: 1 },
      });

      renderAt('/logs');

      await waitFor(() => {
        expect(screen.getAllByText(/Namunalar|samples/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Yaratish')).toBeInTheDocument();
      });

      // Tafsilot tugmasi bosilganda modal ochiladi
      const detailBtn = screen.getByText('Tafsilot');
      fireEvent.click(detailBtn);

      await waitFor(() => {
        expect(screen.getByText('Audit yozuvi tafsiloti')).toBeInTheDocument();
        expect(screen.getByText(/Yangi Namuna/)).toBeInTheDocument();
      });
    });

    it('chemist roli /logs ga kirganda so‘rov yuborilmaydi (ruxsatsiz kirish bloklangan)', async () => {
      loginAs('chemist');
      let requested = false;
      api.onGet(/\/audit/).reply(() => {
        requested = true;
        return [403, { error: { code: 'FORBIDDEN', message: 'Forbidden' } }];
      });

      renderAt('/logs');

      // Chemist RoleRoute tomonidan bloklanadi (bosh sahifaga yo'naltiriladi yoki 404/403)
      await waitFor(() => {
        expect(requested).toBe(false);
      });
    });
  });

  describe('/activity (ActivityPage)', () => {
    it('lab_head /activity sahifasida o‘z kompaniyasi faoliyat jurnali ko‘radi', async () => {
      loginAs('lab_head');
      api.onGet(/\/activity/).reply(200, {
        data: [mockAuditLog],
        meta: { page: 1, limit: 15, total: 1 },
      });

      renderAt('/activity');

      await waitFor(() => {
        expect(screen.getAllByText(/Namunalar|samples/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Yaratish')).toBeInTheDocument();
      });
    });

    it('chemist va kontrolyor rollarida /activity ga so‘rov yuborilmaydi', async () => {
      loginAs('chemist');
      let requested = false;
      api.onGet(/\/activity/).reply(() => {
        requested = true;
        return [403, { error: { code: 'FORBIDDEN', message: 'Forbidden' } }];
      });

      renderAt('/activity');

      await waitFor(() => {
        expect(requested).toBe(false);
      });
    });

    it('super_admin /activity ga kirmaydi va unga so‘rov ketmaydi', async () => {
      loginAs('super_admin');
      let requested = false;
      api.onGet(/\/activity/).reply(() => {
        requested = true;
        return [403, { error: { code: 'FORBIDDEN', message: 'Forbidden' } }];
      });

      renderAt('/activity');

      await waitFor(() => {
        expect(requested).toBe(false);
      });
    });
  });
});
