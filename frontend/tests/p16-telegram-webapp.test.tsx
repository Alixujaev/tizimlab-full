import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import type { TelegramWebApp } from '@/lib/telegram';
import type { ReagentDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

/**
 * P16 — yangi UI Telegram WebApp mobil shell'i ichida (D-166): reaktiv tasdiqlash paneli,
 * "Muddati yaqin" filtri va protokol xonasi tanlovi mobil ko'rinishda ishlaydi.
 */

function telegramStub(): TelegramWebApp {
  const chain = () => vi.fn().mockReturnThis();
  return {
    initData: 'query_id=1&user=%7B%22id%22%3A100%7D&auth_date=1600000000&hash=h',
    initDataUnsafe: { user: { id: 100, first_name: 'T' } },
    version: '7.7',
    platform: 'android',
    colorScheme: 'light',
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
    },
    isExpanded: true,
    viewportHeight: 640,
    viewportStableHeight: 640,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    BackButton: {
      isVisible: false,
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    MainButton: {
      text: '',
      color: '',
      textColor: '',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      setText: chain(),
      onClick: chain(),
      offClick: chain(),
      show: chain(),
      hide: chain(),
      enable: chain(),
      disable: chain(),
      showProgress: chain(),
      hideProgress: chain(),
      setParams: chain(),
    },
    HapticFeedback: {
      impactOccurred: chain(),
      notificationOccurred: chain(),
      selectionChanged: chain(),
    },
    safeAreaInset: { top: 24, bottom: 16, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    isVersionAtLeast: vi.fn(() => true),
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
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    enableVerticalSwipes: vi.fn(),
  } as unknown as TelegramWebApp;
}

let api: MockAdapter;

const reagent: ReagentDto = {
  id: 'reag-m',
  companyId: 'c1',
  name: 'Sulfat kislota',
  casNumber: null,
  unit: 'ml',
  quantity: 100,
  lowStockThreshold: 10,
  expiresAt: '2026-12-20',
  supplier: null,
  storageConditions: null,
  isHazardous: false,
  isLowStock: false,
  isExpired: false,
  isExpiringSoon: true,
  approvalStatus: 'pending',
  createdBy: 'u9',
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

describe('P16: Telegram WebApp mobil shell', () => {
  beforeEach(() => {
    window.Telegram = { WebApp: telegramStub() };
    api = new MockAdapter(apiClient);
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 0 } });
    api.onGet(/\/notifications/).reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
  });
  afterEach(() => {
    delete window.Telegram;
    api.restore();
    resetAuth();
  });

  it('kimyogar reaktivni Telegram ichida tasdiqlay oladi (panel va tugmalar mobil shell’da)', async () => {
    loginAs('chemist');
    api.onGet('/reagents/reag-m').reply(200, { data: reagent });
    api
      .onGet('/reagents/reag-m/transactions')
      .reply(200, { data: [], meta: { page: 1, limit: 15, total: 0 } });
    api.onGet('/reagents/reag-m/documents').reply(200, { data: [] });
    renderAt('/reagents/reag-m');
    expect(
      await screen.findByText('Reaktiv tasdiqlashni kutmoqda', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tasdiqlash' })).toBeInTheDocument();
    // Mobil shell: pastki navigatsiya mavjud
    await waitFor(() => expect(screen.getByRole('button', { name: /Yana/i })).toBeInTheDocument());
  });

  it('reaktivlar ro‘yxati: "Muddati yaqin" va "Tasdiq kutilmoqda" belgilari mobil ko‘rinishda', async () => {
    loginAs('lab_head');
    api.onGet('/reagents').reply(200, { data: [reagent], meta: { page: 1, limit: 20, total: 1 } });
    renderAt('/reagents');
    expect(await screen.findByText('Sulfat kislota', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getAllByText('Muddati yaqin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tasdiq kutilmoqda').length).toBeGreaterThan(0);
  });
});
