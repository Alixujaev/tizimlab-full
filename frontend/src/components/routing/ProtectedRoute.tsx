import { Navigate, Outlet, useLocation } from 'react-router';
import { AppSkeleton } from '@/components/layout/AppSkeleton';
import { useAuthStore } from '@/store/authStore';

/** Sessiya aniqlanguncha ilova skeleti; anonim foydalanuvchi `/login` ga (qaytish manzili bilan). */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'unknown') return <AppSkeleton />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
