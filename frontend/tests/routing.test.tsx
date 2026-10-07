import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { Role } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

const COMPANY: Role[] = ['kontrolyor', 'chemist', 'lab_head', 'director', 'admin'];

describe('ProtectedRoute', () => {
  it("sessiya aniqlanmaguncha spinner ko'rsatadi", () => {
    resetAuth('unknown');
    renderAt('/samples');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it("anonim foydalanuvchi /login ga yo'naltiriladi", async () => {
    resetAuth('anonymous');
    const { router } = renderAt('/samples');
    expect(await screen.findByRole('heading', { name: 'Tizimga kirish' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('RoleRoute', () => {
  it.each([
    ['/users', ['lab_head', 'director', 'admin']],
    ['/activity', ['lab_head', 'director', 'admin']],
    ['/companies', ['super_admin']],
    ['/logs', ['super_admin']],
    ['/samples', COMPANY],
    ['/registry', COMPANY],
    ['/temperature', COMPANY],
    ['/substances', COMPANY],
    ['/reagents/journal', COMPANY],
    ['/expenses', COMPANY],
    ['/stability/5', COMPANY],
  ] as [string, Role[]][])('%s faqat ruxsat etilgan rollarga ochiq', async (path, allowed) => {
    for (const role of ['super_admin', ...COMPANY] as Role[]) {
      loginAs(role);
      const { unmount } = renderAt(path);
      const forbidden = screen.queryByRole('heading', { name: "Ruxsat yo'q" });
      if (allowed.includes(role)) expect(forbidden, `${role} → ${path}`).toBeNull();
      else expect(forbidden, `${role} → ${path}`).not.toBeNull();
      unmount();
    }
  });

  it('/profile barcha rollarga ochiq', () => {
    for (const role of ['super_admin', ...COMPANY] as Role[]) {
      loginAs(role);
      const { unmount } = renderAt('/profile');
      expect(screen.getByRole('heading', { name: 'Profil' })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('redirectlar', () => {
  it.each(['/protocols', '/protocols/42'])('%s → /registry', async (path) => {
    loginAs('chemist');
    const { router } = renderAt(path);
    expect(await screen.findByRole('heading', { name: 'Reyestr' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/registry');
  });

  it('super_admin uchun / → /companies', async () => {
    loginAs('super_admin');
    const { router } = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Kompaniyalar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/companies');
  });

  it('kompaniya roli uchun / dashboard', () => {
    loginAs('lab_head');
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Bosh sahifa' })).toBeInTheDocument();
  });

  it("noma'lum yo'l → NotFound", () => {
    loginAs('admin');
    renderAt('/no/such/page');
    expect(screen.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeInTheDocument();
  });
});
