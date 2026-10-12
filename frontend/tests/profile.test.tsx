import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  localStorage.clear();
  api = new MockAdapter(apiClient);
  loginAs('chemist');
});

afterEach(() => {
  api.restore();
});

describe('ProfilePage', () => {
  it("foydalanuvchi ma'lumotlarini (email, rol, kompaniya) to'g'ri ko'rsatadi", () => {
    renderAt('/profile');

    expect(screen.getByRole('heading', { name: 'Profil' })).toBeInTheDocument();
    expect(screen.getByText('chemist@test.uz')).toBeInTheDocument();
    expect(screen.getByText('Kimyogar')).toBeInTheDocument();
    expect(screen.getByText('Test Lab')).toBeInTheDocument();
    expect(screen.getByLabelText("To'liq ism")).toHaveValue('Test Foydalanuvchi');
  });

  it("super_admin uchun kompaniya o'rniga 'Platforma ma'muriyati' ko'rsatiladi", () => {
    loginAs('super_admin');
    renderAt('/profile');

    expect(screen.getByText("Platforma ma'muriyati")).toBeInTheDocument();
    expect(screen.getByText('Super-administrator')).toBeInTheDocument();
  });

  it("ismni yangilash: PATCH /auth/profile yuboriladi va saqlanadi", async () => {
    const user = userEvent.setup();
    api.onPatch('/auth/profile').reply(200, {
      data: {
        id: 'u1',
        email: 'chemist@test.uz',
        fullName: 'Ziyoda Kimyogarova',
        role: 'chemist',
        companyId: 'c1',
        company: { id: 'c1', name: 'Test Lab', slug: 'test-lab' },
      },
    });

    renderAt('/profile');

    const nameInput = screen.getByLabelText("To'liq ism");
    await user.clear(nameInput);
    await user.type(nameInput, 'Ziyoda Kimyogarova');

    await user.click(screen.getByRole('button', { name: 'Ismni saqlash' }));

    expect(await screen.findByText('Ism muvaffaqiyatli yangilandi.')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.history.patch.some((p) => p.url === '/auth/profile')).toBe(true);
      expect(useAuthStore.getState().user?.fullName).toBe('Ziyoda Kimyogarova');
    });
  });

  it("parolni o'zgartirish: validatsiya va PUT /auth/password", async () => {
    const user = userEvent.setup();
    api.onPut('/auth/password').reply(200, { data: { success: true } });

    renderAt('/profile');

    const currentInput = screen.getByLabelText('Joriy parol');
    const newInput = screen.getByLabelText('Yangi parol');
    const confirmInput = screen.getByLabelText('Yangi parolni tasdiqlang');
    const submitBtn = screen.getByRole('button', { name: 'Parolni yangilash' });

    // Bo'sh holda bosish
    await user.click(submitBtn);
    expect(await screen.findByText('Parol kiriting.')).toBeInTheDocument();

    // Mos kelmagan parollar
    await user.type(currentInput, 'EskiParol123');
    await user.type(newInput, 'YangiParol456');
    await user.type(confirmInput, 'BoshqaParol789');
    await user.click(submitBtn);
    expect(await screen.findByText('Yangi parollar bir-biriga mos kelmadi.')).toBeInTheDocument();

    // To'g'ri to'ldirish
    await user.clear(confirmInput);
    await user.type(confirmInput, 'YangiParol456');
    await user.click(submitBtn);

    expect(await screen.findByText('Parolingiz muvaffaqiyatli yangilandi.')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.history.put.some((p) => p.url === '/auth/password')).toBe(true);
    });
  });

  it("tilni almashtirish interfeys tilini va storage'ni o'zgartiradi", async () => {
    const user = userEvent.setup();
    renderAt('/profile');

    const select = screen.getByLabelText('Tizim tili');
    await user.selectOptions(select, 'ru');

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(await screen.findByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  });

  it("Telegram integratsiyasi bloki profil sahifasida mavjud (P11, R-USER-13, R-USER-14)", () => {
    renderAt('/profile');

    expect(screen.getByRole('heading', { name: /Telegram integratsiyasi/i })).toBeInTheDocument();
  });

  it("Telegram ulanmagan holat: 'Telegram hisobi ulanmagan' holati, 'Telegram ulash' tugmasi va token yaratish modali ochiladi", async () => {
    const user = userEvent.setup();
    api.onGet('/telegram/status').reply(200, {
      data: {
        linked: false,
        telegramChatId: null,
        telegramUsername: null,
        linkedAt: null,
      },
    });
    api.onPost('/telegram/link-token').reply(200, {
      data: {
        token: 'test-link-token-12345',
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
        linkUrl: 'https://t.me/TizimLab_bot?start=test-link-token-12345',
      },
    });

    renderAt('/profile');

    expect(await screen.findByText("Telegram hisobi ulanmagan")).toBeInTheDocument();
    const linkBtn = await screen.findByRole('button', { name: 'Telegram ulash' });
    expect(linkBtn).toBeInTheDocument();

    await user.click(linkBtn);

    expect(await screen.findByRole('heading', { name: 'Telegram hisobini ulash' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Botni ochish" })).toHaveAttribute(
      'href',
      'https://t.me/TizimLab_bot?start=test-link-token-12345',
    );
  });

  it("Telegram ulangan holat: username ko'rsatiladi, 'Telegramni uzish' tugmasi tasdiqlash bilan POST /telegram/unlink yuboradi", async () => {
    const user = userEvent.setup();
    api.onGet('/telegram/status').reply(200, {
      data: {
        linked: true,
        telegramChatId: 12345678,
        telegramUsername: 'aziz_kimyogar',
        linkedAt: '2026-10-12T10:00:00.000Z',
      },
    });
    api.onPost('/telegram/unlink').reply(200, {
      data: { success: true },
    });

    renderAt('/profile');

    expect(await screen.findByText("Telegram hisobi ulangan")).toBeInTheDocument();
    expect(screen.getByText('@aziz_kimyogar')).toBeInTheDocument();

    const unlinkBtn = screen.getByRole('button', { name: 'Telegramni uzish' });
    expect(unlinkBtn).toBeInTheDocument();

    await user.click(unlinkBtn);

    expect(await screen.findByText(/Telegram akkauntingizni uzmoqchimisiz/i)).toBeInTheDocument();

    // Tasdiqlash modalidagi "Telegramni uzish" tugmasini bosish
    const confirmButtons = screen.getAllByRole('button', { name: 'Telegramni uzish' });
    const modalConfirmBtn = confirmButtons[confirmButtons.length - 1]!;
    await user.click(modalConfirmBtn);

    await waitFor(() => {
      expect(api.history.post.some((p) => p.url === '/telegram/unlink')).toBe(true);
    });
  });
});
