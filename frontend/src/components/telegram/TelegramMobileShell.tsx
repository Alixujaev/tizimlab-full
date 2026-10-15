import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BrandMark } from '@/components/layout/BrandMark';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ErrorBoundary } from '@/components/routing/ErrorBoundary';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import {
  bindTelegramBackButton,
  getTelegramWebApp,
  isTelegramWebApp,
  telegramHaptic,
} from '@/lib/telegram';
import { setupTelegramThemeListener } from '@/lib/telegramTheme';
import { ConfirmDialog, Drawer, Icon, Pressable, type IconName } from '@/ui';
import type { Role } from '@/types';

interface BottomTab {
  key: string;
  path: string;
  icon: IconName;
  labelKey: string;
  shortKey: string;
}

interface MoreItem {
  key: string;
  path: string;
  icon: IconName;
  labelKey: string;
}

export function getTabsForRole(role: Role): { tabs: BottomTab[]; moreItems: MoreItem[] } {
  if (role === 'super_admin') {
    return {
      tabs: [
        {
          key: 'companies',
          path: '/companies',
          icon: 'building',
          labelKey: 'nav.companies',
          shortKey: 'nav.companiesShort',
        },
        {
          key: 'logs',
          path: '/logs',
          icon: 'activity',
          labelKey: 'nav.audit',
          shortKey: 'nav.auditShort',
        },
        {
          key: 'profile',
          path: '/profile',
          icon: 'user',
          labelKey: 'nav.profile',
          shortKey: 'nav.profileShort',
        },
      ],
      moreItems: [],
    };
  }

  if (role === 'chemist' || role === 'kontrolyor') {
    return {
      tabs: [
        {
          key: 'home',
          path: '/',
          icon: 'home',
          labelKey: 'nav.dashboard',
          shortKey: 'nav.dashboardShort',
        },
        {
          key: 'samples',
          path: '/samples',
          icon: 'flask',
          labelKey: 'nav.samples',
          shortKey: 'nav.samplesShort',
        },
        {
          key: 'registry',
          path: '/registry',
          icon: 'clipboard',
          labelKey: 'nav.registry',
          shortKey: 'nav.registryShort',
        },
        {
          key: 'me',
          path: '/me',
          icon: 'check-circle',
          labelKey: 'nav.myResults',
          shortKey: 'nav.myResultsShort',
        },
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
        {
          key: 'home',
          path: '/',
          icon: 'home',
          labelKey: 'nav.dashboard',
          shortKey: 'nav.dashboardShort',
        },
        {
          key: 'samples',
          path: '/samples',
          icon: 'flask',
          labelKey: 'nav.samples',
          shortKey: 'nav.samplesShort',
        },
        {
          key: 'registry',
          path: '/registry',
          icon: 'clipboard',
          labelKey: 'nav.registry',
          shortKey: 'nav.registryShort',
        },
        {
          key: 'team',
          path: '/team',
          icon: 'layers',
          labelKey: 'nav.team',
          shortKey: 'nav.teamShort',
        },
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
      {
        key: 'home',
        path: '/',
        icon: 'home',
        labelKey: 'nav.dashboard',
        shortKey: 'nav.dashboardShort',
      },
      {
        key: 'samples',
        path: '/samples',
        icon: 'flask',
        labelKey: 'nav.samples',
        shortKey: 'nav.samplesShort',
      },
      {
        key: 'users',
        path: '/users',
        icon: 'users',
        labelKey: 'nav.users',
        shortKey: 'nav.usersShort',
      },
      {
        key: 'activity',
        path: '/activity',
        icon: 'activity',
        labelKey: 'nav.activity',
        shortKey: 'nav.activityShort',
      },
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const logoutMutation = useLogout();

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

  const handleLogout = () => {
    sessionStorage.setItem('tizimlab.logged_out', 'true');
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        setLogoutConfirmOpen(false);
        setMoreOpen(false);
        void navigate('/', { replace: true });
      },
    });
  };

  if (!user) return null;

  const { tabs, moreItems } = getTabsForRole(user.role);
  const hasMore = moreItems.length > 0;

  return (
    <div className="flex min-h-[var(--tl-tg-viewport-height,100dvh)] flex-col bg-canvas text-fg">
      {/* Ixcham yuqori sarlavha (Safe-area top hisobga olingan, logo flex-nowrap shrink-0) */}
      <header className="sticky top-0 z-sticky flex h-12 items-center justify-between border-b border-line bg-surface/90 px-3 backdrop-blur-md pt-[env(safe-area-inset-top,0px)] gap-2">
        <BrandMark />
        <div className="flex items-center gap-1 shrink-0">
          <ThemeToggle />
          <LanguageSwitcher />
          <NotificationBell />
        </div>
      </header>

      {/* Asosiy kontent maydoni (pastki navigatsiya balandligi + safe area qoplanmaydi) */}
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 overflow-y-auto outline-none px-3 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
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
              aria-label={t(tab.labelKey)}
              onClick={() => telegramHaptic('selection')}
              className={`flex flex-1 flex-col items-center justify-center py-1.5 px-0.5 text-center min-h-12 min-w-11 transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Icon name={tab.icon} size="md" className="shrink-0 mb-0.5" />
              <span className="text-2xs leading-tight text-center line-clamp-2 max-w-18 break-words">
                {t(tab.shortKey || tab.labelKey)}
              </span>
            </NavLink>
          );
        })}

        {hasMore && (
          <Pressable
            variant="raw"
            aria-label={t('nav.more', 'Yana')}
            onClick={() => {
              telegramHaptic('selection');
              setMoreOpen(true);
            }}
            className="flex flex-1 flex-col items-center justify-center py-1.5 px-0.5 text-center min-h-12 min-w-11 text-fg-muted hover:text-fg transition-colors"
          >
            <Icon name="more-horizontal" size="md" className="shrink-0 mb-0.5" />
            <span className="text-2xs leading-tight text-center line-clamp-2 max-w-18 break-words">
              {t('nav.moreShort', t('nav.more', 'Yana'))}
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
                      ? 'bg-primary-subtle text-primary font-semibold'
                      : 'text-fg hover:bg-surface-muted'
                  }`
                }
              >
                <Icon name={item.icon} size="md" className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}

            <div className="pt-2 mt-2 border-t border-line">
              <Pressable
                variant="raw"
                onClick={() => {
                  telegramHaptic('selection');
                  setLogoutConfirmOpen(true);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium min-h-11 w-full text-danger hover:bg-danger-subtle transition-colors text-left"
              >
                <Icon name="log-out" size="md" className="shrink-0" />
                <span>{t('auth.logout', 'Chiqish')}</span>
              </Pressable>
            </div>
          </div>
        </Drawer>
      )}

      {/* Chiqishni tasdiqlash modali */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title={t('auth.logoutConfirmTitle', 'Tizimdan chiqish')}
        description={t('auth.logoutConfirmDesc', 'Haqiqatan ham hisobingizdan chiqmoqchimisiz?')}
        confirmLabel={t('auth.logout', 'Chiqish')}
        cancelLabel={t('common.cancel', 'Bekor qilish')}
        tone="danger"
        loading={logoutMutation.isPending}
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}
