import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BrandMark } from '@/components/layout/BrandMark';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ErrorBoundary } from '@/components/routing/ErrorBoundary';
import { useAuthStore } from '@/store/authStore';
import {
  bindTelegramBackButton,
  getTelegramWebApp,
  isTelegramWebApp,
  telegramHaptic,
} from '@/lib/telegram';
import { setupTelegramThemeListener } from '@/lib/telegramTheme';
import { Drawer, Icon, Pressable, type IconName } from '@/ui';
import type { Role } from '@/types';

interface BottomTab {
  key: string;
  path: string;
  icon: IconName;
  labelKey: string;
}

interface MoreItem {
  key: string;
  path: string;
  icon: IconName;
  labelKey: string;
}

function getTabsForRole(role: Role): { tabs: BottomTab[]; moreItems: MoreItem[] } {
  if (role === 'super_admin') {
    return {
      tabs: [
        { key: 'companies', path: '/companies', icon: 'building', labelKey: 'nav.companies' },
        { key: 'logs', path: '/logs', icon: 'activity', labelKey: 'nav.audit' },
        { key: 'profile', path: '/profile', icon: 'user', labelKey: 'nav.profile' },
      ],
      moreItems: [],
    };
  }

  if (role === 'chemist' || role === 'kontrolyor') {
    return {
      tabs: [
        { key: 'home', path: '/', icon: 'home', labelKey: 'nav.dashboard' },
        { key: 'samples', path: '/samples', icon: 'flask', labelKey: 'nav.samples' },
        { key: 'registry', path: '/registry', icon: 'clipboard', labelKey: 'nav.registry' },
        { key: 'me', path: '/me', icon: 'check-circle', labelKey: 'nav.myResults' },
      ],
      moreItems: [
        { key: 'substances', path: '/substances', icon: 'beaker', labelKey: 'nav.substances' },
        { key: 'temperature', path: '/temperature', icon: 'thermometer', labelKey: 'nav.temperature' },
        { key: 'profile', path: '/profile', icon: 'user', labelKey: 'nav.profile' },
      ],
    };
  }

  if (role === 'lab_head' || role === 'director') {
    return {
      tabs: [
        { key: 'home', path: '/', icon: 'home', labelKey: 'nav.dashboard' },
        { key: 'samples', path: '/samples', icon: 'flask', labelKey: 'nav.samples' },
        { key: 'registry', path: '/registry', icon: 'clipboard', labelKey: 'nav.registry' },
        { key: 'team', path: '/team', icon: 'layers', labelKey: 'nav.team' },
      ],
      moreItems: [
        { key: 'me', path: '/me', icon: 'check-circle', labelKey: 'nav.myResults' },
        { key: 'users', path: '/users', icon: 'users', labelKey: 'nav.users' },
        { key: 'activity', path: '/activity', icon: 'activity', labelKey: 'nav.activity' },
        { key: 'substances', path: '/substances', icon: 'beaker', labelKey: 'nav.substances' },
        { key: 'reagents', path: '/reagents', icon: 'package', labelKey: 'nav.reagents' },
        { key: 'temperature', path: '/temperature', icon: 'thermometer', labelKey: 'nav.temperature' },
        { key: 'stability', path: '/stability', icon: 'clock', labelKey: 'nav.stability' },
        { key: 'profile', path: '/profile', icon: 'user', labelKey: 'nav.profile' },
      ],
    };
  }

  // Admin
  return {
    tabs: [
      { key: 'home', path: '/', icon: 'home', labelKey: 'nav.dashboard' },
      { key: 'samples', path: '/samples', icon: 'flask', labelKey: 'nav.samples' },
      { key: 'users', path: '/users', icon: 'users', labelKey: 'nav.users' },
      { key: 'activity', path: '/activity', icon: 'activity', labelKey: 'nav.activity' },
    ],
    moreItems: [
      { key: 'registry', path: '/registry', icon: 'clipboard', labelKey: 'nav.registry' },
      { key: 'substances', path: '/substances', icon: 'beaker', labelKey: 'nav.substances' },
      { key: 'reagents', path: '/reagents', icon: 'package', labelKey: 'nav.reagents' },
      { key: 'temperature', path: '/temperature', icon: 'thermometer', labelKey: 'nav.temperature' },
      { key: 'stability', path: '/stability', icon: 'clock', labelKey: 'nav.stability' },
      { key: 'profile', path: '/profile', icon: 'user', labelKey: 'nav.profile' },
    ],
  };
}

/**
 * Telegram WebApp mobil shell (P14, D-166).
 * Sidebar o'rniga pastki navigatsiya paneli, safe-area-inset, ixcham yuqori panel
 * va Telegram BackButton / Viewport integratsiyasi.
 */
export function TelegramMobileShell() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // 1) Telegram mavzusi sinxronizatsiyasi
  useEffect(() => {
    return setupTelegramThemeListener();
  }, []);

  // 2) Telegram native BackButton boshqaruvi (D-166)
  useEffect(() => {
    if (!isTelegramWebApp()) return;
    if (location.pathname === '/') return;

    return bindTelegramBackButton(() => {
      telegramHaptic('impact', 'light');
      void navigate(-1);
    });
  }, [location.pathname, navigate]);

  // 3) Telegram viewport o'zgarishini CSS o'zgaruvchiga yozish
  useEffect(() => {
    if (!isTelegramWebApp()) return;
    const tg = getTelegramWebApp();
    if (!tg) return;

    const updateViewport = () => {
      const height = tg.viewportHeight || window.innerHeight;
      document.documentElement.style.setProperty('--tl-tg-viewport-height', `${height}px`);
    };

    updateViewport();
    try {
      tg.onEvent('viewportChanged', updateViewport);
      return () => tg.offEvent('viewportChanged', updateViewport);
    } catch {
      // jimgina fallback
    }
  }, []);

  // 4) Klaviatura ochilganda forma maydoni ko'rinmay qolmasligi uchun fokus boshqaruvi
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      }
    };

    window.addEventListener('focusin', handleFocus);
    return () => window.removeEventListener('focusin', handleFocus);
  }, []);

  if (!user) return null;

  const { tabs, moreItems } = getTabsForRole(user.role);
  const hasMore = moreItems.length > 0;

  return (
    <div className="flex min-h-[var(--tl-tg-viewport-height,100dvh)] flex-col bg-canvas text-fg">
      {/* Ixcham yuqori sarlavha (Safe-area top hisobga olingan) */}
      <header className="sticky top-0 z-sticky flex h-12 items-center justify-between border-b border-line bg-surface/90 px-3 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <BrandMark />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
          <NotificationBell />
        </div>
      </header>

      {/* Asosiy kontent maydoni */}
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 overflow-y-auto outline-none px-3 pt-3 pb-24"
      >
        <ErrorBoundary resetKey={location.pathname}>
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </ErrorBoundary>
      </main>

      {/* Pastki navigatsiya paneli (Safe-area bottom hisobga olingan, kamida 44px teginish maydoni) */}
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-sticky flex items-stretch border-t border-line bg-surface shadow-lg pb-[env(safe-area-inset-bottom,0px)]"
      >
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);

          return (
            <NavLink
              key={tab.key}
              to={tab.path}
              onClick={() => telegramHaptic('selection')}
              className={`flex flex-1 flex-col items-center justify-center py-2 px-1 text-center min-h-12 min-w-11 transition-colors ${
                isActive ? 'text-primary font-medium' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Icon name={tab.icon} size="md" className="shrink-0 mb-1" />
              <span className="text-xs leading-tight truncate max-w-16">
                {t(tab.labelKey)}
              </span>
            </NavLink>
          );
        })}

        {hasMore && (
          <Pressable
            variant="raw"
            onClick={() => {
              telegramHaptic('selection');
              setMoreOpen(true);
            }}
            className="flex flex-1 flex-col items-center justify-center py-2 px-1 text-center min-h-12 min-w-11 text-fg-muted hover:text-fg transition-colors"
          >
            <Icon name="more-horizontal" size="md" className="shrink-0 mb-1" />
            <span className="text-xs leading-tight truncate max-w-16">
              {t('nav.more', 'Yana')}
            </span>
          </Pressable>
        )}
      </nav>

      {/* "Yana" (More) pastdan chiqadigan Sheet Drawer */}
      {hasMore && (
        <Drawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title={t('nav.more', 'Yana')}
          side="bottom"
        >
          <div className="flex flex-col gap-1 p-3">
            {moreItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={() => {
                  telegramHaptic('selection');
                  setMoreOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium min-h-11 transition-colors ${
                    isActive
                      ? 'bg-primary-subtle text-primary-fg font-semibold'
                      : 'text-fg hover:bg-surface-muted'
                  }`
                }
              >
                <Icon name={item.icon} size="md" className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        </Drawer>
      )}
    </div>
  );
}
