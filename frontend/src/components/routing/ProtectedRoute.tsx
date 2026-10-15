import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { AppSkeleton } from '@/components/layout/AppSkeleton';
import { useTelegramAuth } from '@/hooks/useTelegramAuth';
import { isTelegramWebApp } from '@/lib/telegram';
import { useAuthStore } from '@/store/authStore';

const TelegramAuthScreen = lazy(() =>
  import('@/pages/telegram/TelegramAuthScreen').then((m) => ({
    default: m.TelegramAuthScreen,
  })),
);

function TelegramAuthGate() {
  const { state, errorMessage, retry } = useTelegramAuth();
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Outlet />;
  return (
    <Suspense fallback={<AppSkeleton />}>
      <TelegramAuthScreen state={state} errorMessage={errorMessage} onRetry={retry} />
    </Suspense>
  );
}

/** Sessiya aniqlanguncha ilova skeleti; anonim foydalanuvchi `/login` ga (qaytish manzili bilan). */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (isTelegramWebApp()) {
    if (status === 'authenticated') return <Outlet />;
    return <TelegramAuthGate />;
  }

  if (status === 'unknown') return <AppSkeleton />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
