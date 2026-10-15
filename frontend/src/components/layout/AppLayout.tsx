import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { AppSkeleton } from '@/components/layout/AppSkeleton';
import { ErrorBoundary } from '@/components/routing/ErrorBoundary';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { DESKTOP_QUERY, Drawer, PageContainer, useMediaQuery } from '@/ui';
import { BrandMark } from './BrandMark';
import { Sidebar, SidebarNav } from './Sidebar';
import { TopBar } from './TopBar';
import { isTelegramWebApp } from '@/lib/telegram';

// P14: Telegram mobile shell alohida lazy chunk sifatida yuklanadi (asosiy chunkni shishirmaydi)
const TelegramMobileShell = lazy(() =>
  import('@/components/telegram/TelegramMobileShell').then((m) => ({
    default: m.TelegramMobileShell,
  })),
);

/** Himoyalangan sahifalar uchun umumiy karkas (ProtectedRoute ichida ishlatiladi). */
export function AppLayout() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const mobileNavOpen = useLayoutStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useLayoutStore((s) => s.setMobileNavOpen);
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  useNotificationSocket();

  // Boshqa sahifaga o'tilganda mobil menyu yopiladi
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, setMobileNavOpen]);

  if (!user) return null;

  if (isTelegramWebApp()) {
    return (
      <Suspense fallback={<AppSkeleton />}>
        <TelegramMobileShell />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-toast rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('topbar.skipToContent')}
      </a>
      <Sidebar role={user.role} />
      <Drawer
        open={mobileNavOpen && !desktop}
        onClose={() => setMobileNavOpen(false)}
        title={t('nav.label')}
        side="left"
        hideTitle
      >
        <div className="px-5 pb-4">
          <BrandMark />
        </div>
        <SidebarNav role={user.role} onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <ErrorBoundary resetKey={location.pathname}>
            {/* Sahifalar orasida yengil o'tish (opacity + translate, reduced-motion'da o'chadi) */}
            <PageContainer key={location.pathname} className="animate-slide-up">
              <Outlet />
            </PageContainer>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
