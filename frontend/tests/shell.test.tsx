import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/routing/ErrorBoundary';
import i18n from '@/i18n';
import { SIDEBAR_STORAGE_KEY, useLayoutStore } from '@/store/layoutStore';
import { applyTheme, THEME_STORAGE_KEY, useThemeStore } from '@/store/themeStore';
import { loginAs, renderAt, resetAuth } from './helpers';

let api: MockAdapter;

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  localStorage.clear();
  useLayoutStore.setState({ sidebarCollapsed: false, mobileNavOpen: false });
  useThemeStore.setState({ preference: 'system' });
  applyTheme('system');
  api = new MockAdapter(apiClient);
  api.onGet(/.*/).reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
});

afterEach(() => {
  api.restore();
});

function mockViewport(desktop: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('Sidebar: ixchamlashtirish', () => {
  it("yig'ish tugmasi: matn faqat ekran o'quvchiga, tanlov saqlanadi, faol sahifa aria-current", async () => {
    render(
      <MemoryRouter initialEntries={['/samples']}>
        <Sidebar role="lab_head" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Asosiy menyu' });
    expect(within(nav).getByRole('link', { name: 'Namunalar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const toggle = screen.getByRole('button', { name: "Menyuni yig'ish" });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Menyuni yoyish' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(within(nav).getByText('Namunalar')).toHaveClass('sr-only');
    // Ixcham holatda ham havola nomi saqlanadi (klaviatura bilan tooltip)
    expect(within(nav).getByRole('link', { name: 'Namunalar' })).toBeInTheDocument();
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
  });
});

describe('Mobil navigatsiya (Drawer)', () => {
  it("menyu tugmasi drawer'ni ochadi, havola bosilganda yopiladi", async () => {
    const restore = mockViewport(false);
    loginAs('chemist');
    const { router } = renderAt('/registry');
    await userEvent.click(await screen.findByRole('button', { name: 'Menyuni ochish' }));
    const drawer = screen.getByRole('dialog', { name: 'Asosiy menyu' });
    await userEvent.click(within(drawer).getByRole('link', { name: 'Namunalar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/samples'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    restore();
  });
});

describe('Qorong‘i rejim (D-154)', () => {
  it('mavzu menyusi: dark → data-theme, saqlanadi; system → atribut olib tashlanadi', async () => {
    loginAs('admin');
    renderAt('/registry');
    await userEvent.click(await screen.findByRole('button', { name: 'Mavzu' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: "Qorong'i" }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Mavzu' }));
    expect(screen.getByRole('menuitemradio', { name: "Qorong'i" })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Tizim sozlamasi' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('login sahifasida ham mavzu va til tanlovi bor', async () => {
    resetAuth('anonymous');
    renderAt('/login');
    expect(await screen.findByRole('button', { name: 'Mavzu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Til' })).toBeInTheDocument();
  });
});

describe('Qobiq', () => {
  it("asosiy mazmunga o'tish havolasi va sahifa o'tish animatsiyasi", async () => {
    loginAs('lab_head');
    renderAt('/registry');
    const skip = await screen.findByRole('link', { name: "Asosiy mazmunga o'tish" });
    expect(skip).toHaveAttribute('href', '#main');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main.firstElementChild).toHaveClass('animate-slide-up', 'max-w-page');
  });

  it('sessiya aniqlanguncha spinner emas — skelet (role=status)', () => {
    resetAuth('unknown');
    const { container } = renderAt('/samples');
    expect(screen.getByRole('status')).toHaveTextContent('Yuklanmoqda…');
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(container.querySelector('.animate-pulse-soft')).not.toBeNull();
  });

  it('403 va 404 sahifalari: h1 va bosh sahifaga havola', () => {
    loginAs('chemist');
    const { unmount } = renderAt('/users');
    expect(screen.getByRole('heading', { level: 1, name: "Ruxsat yo'q" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bosh sahifaga qaytish' })).toHaveAttribute(
      'href',
      '/',
    );
    unmount();
    renderAt('/yoq-sahifa');
    expect(screen.getByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument();
  });

  it("login: parolni ko'rsatish/yashirish (aria-pressed)", async () => {
    resetAuth('anonymous');
    renderAt('/login');
    const password = await screen.findByLabelText('Parol');
    expect(password).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: "Parolni ko'rsatish" });
    await userEvent.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Parolni yashirish' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('ErrorBoundary', () => {
  // Holat render paytida o'qiladi (vaqtinchalik xato keyin yo'qolgan holatni taqlid qiladi)
  let fail = true;
  function Boom(): React.ReactNode {
    if (fail) throw new Error('render xatosi');
    return <p>sahifa mazmuni</p>;
  }

  it("xato ushlanadi; 'Qayta urinish' qayta chizadi; resetKey o'zgarsa tozalanadi", async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fail = true;
    const Harness = ({ k }: { k: string }) => (
      <ErrorBoundary resetKey={k}>
        <Boom />
      </ErrorBoundary>
    );
    const { rerender } = render(<Harness k="/a" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Sahifani ko'rsatib bo'lmadi");
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(screen.getByText('sahifa mazmuni')).toBeInTheDocument();

    fail = true;
    rerender(<Harness k="/b" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fail = false;
    rerender(<Harness k="/c" />);
    expect(screen.getByText('sahifa mazmuni')).toBeInTheDocument();
    spy.mockRestore();
  });
});
