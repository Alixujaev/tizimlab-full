import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import {
  bindTelegramBackButton,
  bindTelegramMainButton,
  canRoleAccessPath,
  getTelegramInitData,
  getTelegramPlatform,
  getTelegramSafeArea,
  getTelegramViewport,
  isTelegramVersionAtLeast,
  isTelegramWebApp,
  parseStartParam,
  setTelegramClosingConfirmation,
  telegramHaptic,
  telegramOpenLink,
  telegramReady,
  telegramShowAlert,
  telegramShowConfirm,
  type TelegramWebApp,
} from '@/lib/telegram';
import {
  getContrastRatio,
  getLuminance,
  setupTelegramThemeListener,
  syncTelegramTheme,
} from '@/lib/telegramTheme';
import { TelegramAuthScreen } from '@/pages/telegram/TelegramAuthScreen';
import { MobileFileUpload } from '@/components/telegram/MobileFileUpload';
import { TelegramMobileShell } from '@/components/telegram/TelegramMobileShell';
import { useAuthStore } from '@/store/authStore';
import { MemoryRouter } from 'react-router';
import type { Role, User } from '@/types';

function createMockTelegramWebApp(overrides: Partial<TelegramWebApp> = {}): TelegramWebApp {
  const backButton = {
    isVisible: false,
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
  };

  const mainButton = {
    text: '',
    color: '',
    textColor: '',
    isVisible: false,
    isActive: true,
    isProgressVisible: false,
    setText: vi.fn().mockReturnThis(),
    onClick: vi.fn().mockReturnThis(),
    offClick: vi.fn().mockReturnThis(),
    show: vi.fn().mockReturnThis(),
    hide: vi.fn().mockReturnThis(),
    enable: vi.fn().mockReturnThis(),
    disable: vi.fn().mockReturnThis(),
    showProgress: vi.fn().mockReturnThis(),
    hideProgress: vi.fn().mockReturnThis(),
    setParams: vi.fn().mockReturnThis(),
  };

  const haptic = {
    impactOccurred: vi.fn().mockReturnThis(),
    notificationOccurred: vi.fn().mockReturnThis(),
    selectionChanged: vi.fn().mockReturnThis(),
  };

  return {
    initData: 'query_id=123&user=%7B%22id%22%3A100%7D&auth_date=1600000000&hash=mockhash',
    initDataUnsafe: {
      user: { id: 100, first_name: 'TestUser' },
      start_param: 'sample_abc123',
    },
    version: '7.7',
    platform: 'ios',
    colorScheme: 'light',
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#888888',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
    },
    isExpanded: true,
    viewportHeight: 700,
    viewportStableHeight: 700,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    BackButton: backButton,
    MainButton: mainButton,
    HapticFeedback: haptic,
    safeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
    contentSafeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
    isVersionAtLeast: vi.fn((v: string) => v <= '7.7'),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    enableClosingConfirmation: vi.fn(),
    disableClosingConfirmation: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
    sendData: vi.fn(),
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    openInvoice: vi.fn(),
    showPopup: vi.fn(),
    showAlert: vi.fn((msg, cb) => cb?.()),
    showConfirm: vi.fn((msg, cb) => cb?.(true)),
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    enableVerticalSwipes: vi.fn(),
    ...overrides,
  };
}

describe('P14 — Telegram WebApp integratsiyasi va Mobil UI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uz');
    useAuthStore.getState().clear();
    delete window.Telegram;
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--tl-surface');
    document.documentElement.style.removeProperty('--tl-fg');
  });

  describe('1. Telegram.ts muhit ko\'prigi (WebApp ichida / tashqarisida)', () => {
    it('Telegram tashqarisida (oddiy brauzer) isTelegramWebApp false qaytaradi va xato bermaydi', () => {
      delete window.Telegram;
      expect(isTelegramWebApp()).toBe(false);
      expect(getTelegramInitData()).toBe('');
      expect(getTelegramPlatform()).toBe('unknown');
      expect(getTelegramSafeArea()).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
      expect(isTelegramVersionAtLeast('7.0')).toBe(false);

      // Hech qanday metod tashqarida xato tashlamaydi
      expect(() => telegramReady()).not.toThrow();
      expect(() => telegramHaptic('impact', 'medium')).not.toThrow();
      expect(() => setTelegramClosingConfirmation(true)).not.toThrow();
    });

    it('Telegram WebApp ichida isTelegramWebApp true qaytaradi va metodlar to\'g\'ri ishlaydi', () => {
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };

      expect(isTelegramWebApp()).toBe(true);
      expect(getTelegramInitData()).toBe(mockTg.initData);
      expect(getTelegramPlatform()).toBe('ios');
      expect(getTelegramSafeArea()).toEqual({ top: 44, bottom: 34, left: 0, right: 0 });
      expect(getTelegramViewport().height).toBe(700);

      telegramReady();
      expect(mockTg.ready).toHaveBeenCalled();

      telegramHaptic('impact', 'heavy');
      expect(mockTg.HapticFeedback.impactOccurred).toHaveBeenCalledWith('heavy');

      telegramHaptic('notification', 'success');
      expect(mockTg.HapticFeedback.notificationOccurred).toHaveBeenCalledWith('success');

      telegramHaptic('selection');
      expect(mockTg.HapticFeedback.selectionChanged).toHaveBeenCalled();

      setTelegramClosingConfirmation(true);
      expect(mockTg.enableClosingConfirmation).toHaveBeenCalled();

      setTelegramClosingConfirmation(false);
      expect(mockTg.disableClosingConfirmation).toHaveBeenCalled();
    });

    it('telegramOpenLink Telegram ichida tg.openLink ni chaqiradi, tashqarida window.open fallback', () => {
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };

      telegramOpenLink('https://lab.tizimlab.uz/profile');
      expect(mockTg.openLink).toHaveBeenCalledWith('https://lab.tizimlab.uz/profile', {
        try_instant_view: undefined,
      });

      // Tashqarida
      delete window.Telegram;
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      telegramOpenLink('https://lab.tizimlab.uz/login');
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://lab.tizimlab.uz/login',
        '_blank',
        'noopener,noreferrer',
      );
      windowOpenSpy.mockRestore();
    });

    it('telegramShowConfirm va telegramShowAlert Telegram native dialogini ishlatadi', async () => {
      const mockTg = createMockTelegramWebApp({
        showConfirm: vi.fn((_msg, cb) => cb?.(true)),
        showAlert: vi.fn((_msg, cb) => cb?.()),
      });
      window.Telegram = { WebApp: mockTg };

      const confirmed = await telegramShowConfirm('Rostdan ham o\'chirmoqchimisiz?');
      expect(confirmed).toBe(true);
      expect(mockTg.showConfirm).toHaveBeenCalledWith(
        'Rostdan ham o\'chirmoqchimisiz?',
        expect.any(Function),
      );

      await telegramShowAlert('Muvaffaqiyatli saqlandi!');
      expect(mockTg.showAlert).toHaveBeenCalledWith(
        'Muvaffaqiyatli saqlandi!',
        expect.any(Function),
      );
    });
  });

  describe('2. BackButton va MainButton hayot sikli (mount/unmount tozalash)', () => {
    it('bindTelegramBackButton chaqirilganda show() qiladi, unmount bo\'lganda offClick() va hide() chaqiriladi', () => {
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };

      const onBackClick = vi.fn();
      const unbind = bindTelegramBackButton(onBackClick);

      expect(mockTg.BackButton.onClick).toHaveBeenCalledWith(onBackClick);
      expect(mockTg.BackButton.show).toHaveBeenCalled();

      // Unmount / tozalash
      unbind();
      expect(mockTg.BackButton.offClick).toHaveBeenCalledWith(onBackClick);
      expect(mockTg.BackButton.hide).toHaveBeenCalled();
    });

    it('bindTelegramMainButton parametrlar bilan ulaydi, progress ko\'rsatadi va unmount da tozalaydi', () => {
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };

      const onMainClick = vi.fn();
      const unbind = bindTelegramMainButton({
        text: 'Yuborish',
        onClick: onMainClick,
        isProgress: true,
      });

      expect(mockTg.MainButton.setParams).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Yuborish' }),
      );
      expect(mockTg.MainButton.onClick).toHaveBeenCalledWith(onMainClick);
      expect(mockTg.MainButton.showProgress).toHaveBeenCalled();
      expect(mockTg.MainButton.show).toHaveBeenCalled();

      // Unmount / tozalash
      unbind();
      expect(mockTg.MainButton.offClick).toHaveBeenCalledWith(onMainClick);
      expect(mockTg.MainButton.hideProgress).toHaveBeenCalled();
      expect(mockTg.MainButton.hide).toHaveBeenCalled();
    });
  });

  describe('3. Tema va themeParams sinxronizatsiyasi (WCAG AA kontrast)', () => {
    it('WCAG kontrast formulasi to\'g\'ri hisoblaydi', () => {
      const black = '#000000';
      const white = '#ffffff';
      expect(getLuminance(black)).toBeCloseTo(0, 2);
      expect(getLuminance(white)).toBeCloseTo(1, 2);
      expect(getContrastRatio(black, white)).toBeCloseTo(21, 0);

      // Past kontrastli juftlik (kulrang ustida kulrang)
      const lowContrast = getContrastRatio('#777777', '#888888');
      expect(lowContrast).toBeLessThan(4.5);
    });

    it('syncTelegramTheme va setupTelegramThemeListener Telegram mavzusini jonli yangilaydi', () => {
      const mockTg = createMockTelegramWebApp({
        colorScheme: 'dark',
        themeParams: {
          bg_color: '#1a1a1a',
          text_color: '#ffffff', // Kontrast > 4.5:1
          secondary_bg_color: '#121212',
          button_color: '#3b82f6',
          button_text_color: '#ffffff',
        },
      });
      window.Telegram = { WebApp: mockTg };

      const unsubscribe = setupTelegramThemeListener();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.style.getPropertyValue('--tl-surface')).toBe('#1a1a1a');
      expect(document.documentElement.style.getPropertyValue('--tl-fg')).toBe('#ffffff');
      expect(mockTg.onEvent).toHaveBeenCalledWith('themeChanged', expect.any(Function));

      unsubscribe();
      expect(mockTg.offEvent).toHaveBeenCalledWith('themeChanged', expect.any(Function));
    });

    it('Kontrast WCAG AA (4.5) dan past bo\'lsa xavfli rang qo\'llanmaydi', () => {
      const mockTg = createMockTelegramWebApp({
        colorScheme: 'light',
        themeParams: {
          bg_color: '#888888',
          text_color: '#777777', // Juda past kontrast (< 4.5)
        },
      });
      window.Telegram = { WebApp: mockTg };

      syncTelegramTheme();
      // Past kontrast sababli --tl-surface va --tl-fg o'zgartirilmasligi kerak
      expect(document.documentElement.style.getPropertyValue('--tl-surface')).toBe('');
      expect(document.documentElement.style.getPropertyValue('--tl-fg')).toBe('');
    });
  });

  describe('4. startParam deep link parsing va ruxsat tekshiruvi (403 oldini olish)', () => {
    it('parseStartParam turli formatlarni xavfsiz parse qiladi', () => {
      expect(parseStartParam('sample_123')).toEqual({ path: '/samples/123', id: '123' });
      expect(parseStartParam('s_abc')).toEqual({ path: '/samples/abc', id: 'abc' });
      expect(parseStartParam('registry_456')).toEqual({ path: '/registry/456', id: '456' });
      expect(parseStartParam('r_789')).toEqual({ path: '/registry/789', id: '789' });
      expect(parseStartParam('stability_999')).toEqual({ path: '/stability/999', id: '999' });
      expect(parseStartParam('st_555')).toEqual({ path: '/stability/555', id: '555' });
      expect(parseStartParam('samples')).toEqual({ path: '/samples' });
      expect(parseStartParam('registry')).toEqual({ path: '/registry' });
      expect(parseStartParam('temperature')).toEqual({ path: '/temperature' });
      expect(parseStartParam('me')).toEqual({ path: '/me' });
      expect(parseStartParam('team')).toEqual({ path: '/team' });
      expect(parseStartParam('invalid_unknown')).toBeNull();
    });

    it('canRoleAccessPath ruxsatsiz rolga 403 request yuborilishini qat\'iy to\'xtatadi', () => {
      // Kimyogar
      expect(canRoleAccessPath('chemist', '/samples/123')).toBe(true);
      expect(canRoleAccessPath('chemist', '/registry')).toBe(true);
      expect(canRoleAccessPath('chemist', '/me')).toBe(true);
      expect(canRoleAccessPath('chemist', '/users')).toBe(false);
      expect(canRoleAccessPath('chemist', '/activity')).toBe(false);
      expect(canRoleAccessPath('chemist', '/team')).toBe(false);
      expect(canRoleAccessPath('chemist', '/companies')).toBe(false);

      // Kontrolyor
      expect(canRoleAccessPath('kontrolyor', '/samples')).toBe(true);
      expect(canRoleAccessPath('kontrolyor', '/users')).toBe(false);
      expect(canRoleAccessPath('kontrolyor', '/team')).toBe(false);

      // Lab boshlig'i
      expect(canRoleAccessPath('lab_head', '/team')).toBe(true);
      expect(canRoleAccessPath('lab_head', '/users')).toBe(true);
      expect(canRoleAccessPath('lab_head', '/companies')).toBe(false);

      // Super admin faqat o'ziga ruxsat etilgan joylarga kira oladi
      expect(canRoleAccessPath('super_admin', '/companies')).toBe(true);
      expect(canRoleAccessPath('super_admin', '/logs')).toBe(true);
      expect(canRoleAccessPath('super_admin', '/samples')).toBe(false);
      expect(canRoleAccessPath('super_admin', '/registry')).toBe(false);
    });
  });

  describe('5. Avto-kirish holatlari (TelegramAuthScreen)', () => {
    it('bog\'lanmagan foydalanuvchi holati: aniq yo\'riqnoma va brauzerda ochish tugmasi', () => {
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };

      render(
        <TelegramAuthScreen
          state="unlinked"
          errorMessage="Telegram hisobi ulanmagan"
          onRetry={vi.fn()}
        />,
      );

      expect(screen.getByText(/Telegram hisobingiz bog'lanmagan/i)).toBeInTheDocument();
      expect(screen.getByText(/TizimLab dan foydalanish uchun avval brauzerda/i)).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /Brauzerda ochish/i });
      expect(btn).toBeInTheDocument();

      fireEvent.click(btn);
      expect(mockTg.openLink).toHaveBeenCalledWith(expect.stringContaining('/profile'), expect.any(Object));
    });

    it('eskirgan initData holati: qayta yuklash tugmasi', () => {
      render(
        <TelegramAuthScreen
          state="expired"
          errorMessage="initData eskirgan"
          onRetry={vi.fn()}
        />,
      );

      expect(screen.getByText(/Sessiya muddati eskirgan/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Qayta yuklash/i })).toBeInTheDocument();
    });

    it('tarmoq xatosi holati: qayta urinish tugmasi onRetry ni chaqiradi', () => {
      const retrySpy = vi.fn();
      render(
        <TelegramAuthScreen
          state="network_error"
          errorMessage="Internet yo'q"
          onRetry={retrySpy}
        />,
      );

      expect(screen.getByText(/Tarmoq xatosi/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Qayta urinish/i });
      fireEvent.click(retryBtn);
      expect(retrySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. TelegramMobileShell: rol bo\'yicha pastki navigatsiya va tegish maydoni (>=44px)', () => {
    const setupUser = (role: Role): User => ({
      id: 'u1',
      fullName: 'Test User',
      email: 'test@example.com',
      role,
      companyId: 'c1',
      company: { id: 'c1', name: 'Farm Test MCHJ', slug: 'farm-test' },
    });

    it('chemist roli uchun 4 asosiy tab va "Yana" sheet tugmasi chiqadi', () => {
      useAuthStore.getState().setUser(setupUser('chemist'));
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <TelegramMobileShell />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByRole('link', { name: /Bosh sahifa/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Namunalar/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Reyestr/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Mening natijalarim/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Yana/i })).toBeInTheDocument();
    });

    it('lab_head roli uchun "Jamoa" asosiy menyuda bo\'ladi', () => {
      useAuthStore.getState().setUser(setupUser('lab_head'));
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <TelegramMobileShell />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByRole('link', { name: /Jamoa/i })).toBeInTheDocument();
    });

    it('barcha navigatsiya tugmalari kamida 44px teginish maydoniga ega (min-h-[48px], min-w-[44px])', () => {
      useAuthStore.getState().setUser(setupUser('chemist'));
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <TelegramMobileShell />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const navButtons = container.querySelectorAll('nav a, nav button');
      expect(navButtons.length).toBeGreaterThanOrEqual(4);
      navButtons.forEach((btn) => {
        expect(btn.className).toMatch(/min-h-12/);
        expect(btn.className).toMatch(/min-w-11/);
      });
    });

    it('"Yana" tugmasi bosilganda pastdan sheet ochiladi', async () => {
      useAuthStore.getState().setUser(setupUser('chemist'));
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <TelegramMobileShell />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const moreBtn = screen.getByRole('button', { name: /Yana/i });
      fireEvent.click(moreBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Moddalar/i })).toBeInTheDocument();
      });
    });
  });

  describe('7. Mobil Fayl yuklash (MobileFileUpload): kamera, hajm va format validatsiyasi', () => {
    it('20MB dan katta fayl rad etiladi va aniq xato matni chiqadi', async () => {
      const mockUpload = vi.fn();
      render(<MobileFileUpload onUpload={mockUpload} />);

      // 21 MB fayl
      const bigFile = new File(['x'.repeat(1024)], 'big_protocol.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(bigFile, 'size', { value: 21 * 1024 * 1024 });

      const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      fireEvent.change(fileInput, { target: { files: [bigFile] } });

      await waitFor(() => {
        expect(
          screen.getByText(/Fayl hajmi 20MB dan oshmasligi kerak/i),
        ).toBeInTheDocument();
      });
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('ruxsat etilmagan format rad etiladi va aniq xato matni chiqadi', async () => {
      const mockUpload = vi.fn();
      render(<MobileFileUpload onUpload={mockUpload} />);

      const invalidFile = new File(['content'], 'virus.exe', {
        type: 'application/x-msdownload',
      });

      const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(
          screen.getByText(/Faqat PDF, DOC, DOCX, JPEG, PNG formatlariga ruxsat berilgan/i),
        ).toBeInTheDocument();
      });
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('to\'g\'ri fayl muvaffaqiyatli yuklanadi va openLink ochish imkonini beradi', async () => {
      const mockTg = createMockTelegramWebApp();
      window.Telegram = { WebApp: mockTg };

      const mockUpload = vi.fn().mockResolvedValue({ url: 'https://r2.tizimlab.uz/protocol.pdf' });
      render(<MobileFileUpload onUpload={mockUpload} />);

      const validPdf = new File(['valid content'], 'protocol.pdf', {
        type: 'application/pdf',
      });

      const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [validPdf] } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(validPdf);
        expect(screen.getByText(/Fayl yuklangan/i)).toBeInTheDocument();
      });

      const openBtn = screen.getByRole('button', { name: /Ochish/i });
      fireEvent.click(openBtn);
      expect(mockTg.openLink).toHaveBeenCalledWith('https://r2.tizimlab.uz/protocol.pdf', {
        try_instant_view: undefined,
      });
    });
  });
});
