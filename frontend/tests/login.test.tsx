import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { loginAs, renderAt, resetAuth, userWith } from './helpers';

let api: MockAdapter;
beforeEach(async () => {
  await i18n.changeLanguage('uz');
  api = new MockAdapter(apiClient);
  resetAuth('anonymous');
  vi.spyOn(toast, 'error');
});
afterEach(() => {
  api.restore();
  vi.restoreAllMocks();
});

const fill = async (email: string, password: string) => {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Parol'), password);
  await user.click(screen.getByRole('button', { name: 'Kirish' }));
};

describe('LoginPage', () => {
  it("status 'unknown' paytida spinner ko'rsatiladi", () => {
    resetAuth('unknown');
    renderAt('/login');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it("bo'sh va noto'g'ri formatdagi maydonlar — so'rov yuborilmaydi", async () => {
    renderAt('/login');
    await fill('', '');
    expect(screen.getByText('Email kiriting.')).toBeInTheDocument();
    expect(screen.getByText('Parol kiriting.')).toBeInTheDocument();
    await fill('emas-email', 'x');
    expect(screen.getByText("Email formati noto'g'ri.")).toBeInTheDocument();
    expect(api.history.post).toHaveLength(0);
  });

  it("server xatosi tarjima qilingan xabar bilan ko'rsatiladi, global toast chiqmaydi (INVALID_CREDENTIALS, RATE_LIMITED)", async () => {
    api
      .onPost('/auth/login')
      .replyOnce(401, { error: { code: 'INVALID_CREDENTIALS', message: 'server matni' } })
      .onPost('/auth/login')
      .replyOnce(429, { error: { code: 'RATE_LIMITED', message: 'server matni' } });
    renderAt('/login');
    await fill('a@test.uz', 'Parol123');
    expect(await screen.findByRole('alert')).toHaveTextContent("Email yoki parol noto'g'ri.");
    // Global toast chiqmasligi shart (forma ichida ko'rsatiladi)
    expect(toast.error).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Kirish' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("Urinishlar soni juda ko'p."),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('anonymous');
    // Login so'rovidagi 401 refresh'ni ishga tushirmaydi
    expect(api.history.post.every((r) => r.url === '/auth/login')).toBe(true);
  });

  it("ACCOUNT_INACTIVE xatosi aniq xabar bilan ko'rsatiladi", async () => {
    api
      .onPost('/auth/login')
      .reply(403, { error: { code: 'ACCOUNT_INACTIVE', message: 'nofaol' } });
    renderAt('/login');
    await fill('inactive@test.uz', 'Parol123');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hisobingiz yoki kompaniyangiz faol emas. Administratorga murojaat qiling.',
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("noma'lum kod — umumiy xabar; boshqa tilda ham tarjima", async () => {
    api.onPost('/auth/login').reply(500, { error: { code: 'INTERNAL_ERROR', message: 'x' } });
    await i18n.changeLanguage('en');
    renderAt('/login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'a@test.uz');
    await user.type(screen.getByLabelText('Password'), 'Parol123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.generic'));
  });

  it("muvaffaqiyat: store'ga yoziladi va bosh sahifaga o'tiladi", async () => {
    api.onPost('/auth/login').reply((config) => {
      expect(JSON.parse(config.data as string)).toEqual({
        email: 'chemist@test.uz',
        password: 'Parol123',
      });
      return [200, { data: { accessToken: 'acc-1', user: userWith('chemist') } }];
    });
    const { router } = renderAt('/login');
    await fill('  chemist@test.uz ', 'Parol123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'acc-1',
    });
  });

  it("himoyalangan sahifadan kelgan bo'lsa — login'dan keyin o'sha sahifaga qaytadi", async () => {
    api
      .onPost('/auth/login')
      .reply(200, { data: { accessToken: 'acc-2', user: userWith('lab_head') } });
    const { router } = renderAt('/registry');
    await screen.findByRole('heading', { name: 'Tizimga kirish' });
    await fill('lab_head@test.uz', 'Parol123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/registry'));
  });

  it("super_admin login'dan keyin /companies ga yo'naltiriladi (D-28)", async () => {
    api
      .onPost('/auth/login')
      .reply(200, { data: { accessToken: 'acc-3', user: userWith('super_admin') } });
    const { router } = renderAt('/login');
    await fill('super_admin@test.uz', 'Parol123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/companies'));
  });

  it('autentifikatsiyalangan foydalanuvchi /login ga kirsa — bosh sahifaga', async () => {
    loginAs('admin');
    const { router } = renderAt('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it("so'rov kutilayotganda inputlar va tugma disabled bo'ladi (loading holati)", async () => {
    let finishResponse!: () => void;
    api.onPost('/auth/login').reply(
      () =>
        new Promise((resolve) => {
          finishResponse = () =>
            resolve([200, { data: { accessToken: 't', user: userWith('chemist') } }]);
        }),
    );
    renderAt('/login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'a@test.uz');
    await user.type(screen.getByLabelText('Parol'), 'Parol123');
    await user.click(screen.getByRole('button', { name: 'Kirish' }));

    const submitBtn = screen.getByRole('button', { name: 'Kirilmoqda…' });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Parol')).toBeDisabled();

    finishResponse();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Kirilmoqda…' })).not.toBeInTheDocument(),
    );
  });
});

describe('Logout', () => {
  it('POST /auth/logout → store tozalanadi → /login', async () => {
    api.onPost('/auth/logout').reply(204);
    loginAs('director');
    const { router } = renderAt('/');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Chiqish' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.history.post.map((r) => r.url)).toEqual(['/auth/logout']);
    expect(useAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('server xato bersa ham lokal sessiya tozalanadi', async () => {
    api.onPost('/auth/logout').reply(500, {});
    loginAs('chemist');
    const { router } = renderAt('/');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Chiqish' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
