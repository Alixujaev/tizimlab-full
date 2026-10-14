import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import type {
  AdminUserDto,
  PermissionsCatalogDto,
  UserAuditLogDto,
  UserPermissionsDto,
  UserStatsDto,
} from '@/types';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

const mockUsers: AdminUserDto[] = [
  {
    id: 'u1',
    email: 'admin@test.uz',
    fullName: 'Admin Bek',
    role: 'admin',
    isActive: true,
    companyId: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    email: 'chemist@test.uz',
    fullName: 'Kimyogar Qiz',
    role: 'chemist',
    isActive: true,
    companyId: 'c1',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    lastLoginAt: null,
  },
  {
    id: 'u3',
    email: 'director@test.uz',
    fullName: 'Direktor Aka',
    role: 'director',
    isActive: true,
    companyId: 'c1',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    lastLoginAt: null,
  },
];

const mockStats: UserStatsDto = {
  total: 3,
  active: 3,
  inactive: 0,
  byRole: {
    admin: 1,
    chemist: 1,
    director: 1,
    kontrolyor: 0,
    lab_head: 0,
  },
};

const mockCatalog: PermissionsCatalogDto = {
  catalog: ['samples:create', 'samples:view', 'protocols:upload'],
  roleDefaults: {
    super_admin: [],
    admin: ['samples:view'],
    director: ['samples:view'],
    lab_head: ['samples:create', 'samples:view'],
    chemist: ['samples:view', 'protocols:upload'],
    kontrolyor: ['samples:view'],
  },
};

const mockUserPerms: UserPermissionsDto = {
  userId: 'u2',
  role: 'chemist',
  rolePermissions: ['samples:view', 'protocols:upload'],
  individualPermissions: ['samples:create'],
  effectivePermissions: ['samples:view', 'protocols:upload', 'samples:create'],
};

const mockLogs: UserAuditLogDto[] = [
  {
    id: 'l1',
    action: 'login',
    tableName: 'auth',
    recordId: 'u2',
    oldValues: null,
    newValues: { ip: '127.0.0.1' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla',
    createdAt: '2026-03-01T10:00:00.000Z',
  },
];

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  api = new MockAdapter(apiClient);
});

afterEach(() => {
  api.restore();
});

describe('UsersPage & RBAC UI', () => {
  it("director: statistika va jadvalni ko'radi, lekin yaratish va amal tugmalari yo'q", async () => {
    loginAs('director');
    api.onGet('/admin/users').reply(200, {
      data: mockUsers,
      meta: { page: 1, limit: 10, total: 3 },
    });
    api.onGet('/admin/users/stats').reply(200, { data: mockStats });

    renderAt('/users');

    expect(await screen.findByRole('heading', { name: 'Foydalanuvchilar' })).toBeInTheDocument();
    expect(await screen.findByText('Admin Bek')).toBeInTheDocument();
    expect(screen.getByText('Kimyogar Qiz')).toBeInTheDocument();

    // Stats
    expect(await screen.findByText('Jami foydalanuvchilar')).toBeInTheDocument();

    // Create user tugmasi ko'rinmaydi
    expect(screen.queryByRole('button', { name: 'Yangi foydalanuvchi' })).toBeNull();

    // Jadvaldagi amallar ustuni yo'q
    expect(screen.queryByRole('columnheader', { name: 'Amallar' })).toBeNull();
  });

  it('lab_head: yaratishda faqat chemist/kontrolyor ruxsat etilgan, faqat ularni tahrirlay oladi', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    api.onGet('/admin/users').reply(200, {
      data: mockUsers,
      meta: { page: 1, limit: 10, total: 3 },
    });
    api.onGet('/admin/users/stats').reply(200, { data: mockStats });

    renderAt('/users');
    expect(await screen.findByRole('heading', { name: 'Foydalanuvchilar' })).toBeInTheDocument();
    await screen.findByText('Kimyogar Qiz');

    // Create user tugmasi bor
    const createBtn = screen.getByRole('button', { name: 'Yangi foydalanuvchi' });
    expect(createBtn).toBeInTheDocument();

    await user.click(createBtn);
    expect(await screen.findByRole('heading', { name: 'Yangi foydalanuvchi' })).toBeInTheDocument();

    // Rol tanlash: faqat Kimyogar va Kontrolyor bor, boshqalari yo'q
    // Rol — Select (combobox): variantlar ochilganda ko'rinadi
    const roleSelect = screen.getByLabelText('Rol');
    await user.click(roleSelect);
    const roleValues = screen.getAllByRole('option').map((o) => o.getAttribute('data-value'));
    expect(roleValues).toContain('chemist');
    expect(roleValues).toContain('kontrolyor');
    expect(roleValues).not.toContain('admin');
    expect(roleValues).not.toContain('director');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }));

    // Jadvalda: faqat Kimyogar Qiz qatorida amallar bor, Admin Bek va Direktor Aka qatorida yo'q
    // Kimyogar Qiz amallari: Tahrirlash, Parolni tiklash, Audit jurnali (Ruxsatlar yo'q, chunki u admin-only)
    expect(screen.getAllByRole('button', { name: 'Tahrirlash' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Ruxsatlar' })).toBeNull();
  });

  it("admin: to'liq boshqaruv, ruxsatlar va parolni tiklash modallari", async () => {
    const user = userEvent.setup();
    loginAs('admin');
    api.onGet('/admin/users').reply(200, {
      data: mockUsers,
      meta: { page: 1, limit: 10, total: 3 },
    });
    api.onGet('/admin/users/stats').reply(200, { data: mockStats });
    api.onGet('/admin/permissions/catalog').reply(200, { data: mockCatalog });
    api.onGet('/admin/users/u1/permissions').reply(200, { data: mockUserPerms });
    api.onGet('/admin/users/u2/permissions').reply(200, { data: mockUserPerms });
    api.onPut('/admin/users/u1/permissions').reply(200, { data: { success: true } });
    api.onPut('/admin/users/u2/permissions').reply(200, { data: { success: true } });
    api.onPost('/admin/users/u1/reset-password').reply(200, { data: { success: true } });
    api.onPost('/admin/users/u2/reset-password').reply(200, { data: { success: true } });
    api.onGet('/admin/users/u1/logs').reply(200, {
      data: mockLogs,
      meta: { page: 1, limit: 10, total: 1 },
    });
    api.onGet('/admin/users/u2/logs').reply(200, {
      data: mockLogs,
      meta: { page: 1, limit: 10, total: 1 },
    });

    renderAt('/users');
    expect(await screen.findByRole('heading', { name: 'Foydalanuvchilar' })).toBeInTheDocument();
    await screen.findByText('Admin Bek');
    await screen.findByText('Kimyogar Qiz');

    // Ruxsatlar modali
    const permBtns = await screen.findAllByRole('button', { name: 'Ruxsatlar' });
    await user.click(permBtns[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Ruxsatlar boshqaruvi' }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Rol ruxsati')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ruxsatlarni saqlash' }));
    await waitFor(() => {
      expect(api.history.put.some((p) => p.url?.includes('/permissions'))).toBe(true);
    });

    // Close perms modal
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }));

    // Parolni tiklash modali
    const resetBtns = screen.getAllByRole('button', { name: 'Parolni tiklash' });
    await user.click(resetBtns[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Foydalanuvchi parolini tiklash' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Yangi parol'), 'YangiParol123');
    await user.type(screen.getByLabelText('Yangi parolni tasdiqlang'), 'YangiParol123');

    await user.click(screen.getByRole('button', { name: "Parolni o'zgartirish" }));
    await waitFor(() => {
      expect(api.history.post.some((p) => p.url?.includes('/reset-password'))).toBe(true);
    });

    // Close reset modal
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }));

    // Audit log modali
    const logBtns = screen.getAllByRole('button', { name: 'Audit jurnali' });
    await user.click(logBtns[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Foydalanuvchi faoliyat jurnali' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('login')).toBeInTheDocument();
  });
});
