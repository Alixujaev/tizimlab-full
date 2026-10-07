import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/authStore';

/** Sessiya aniqlanguncha spinner; anonim foydalanuvchi `/login` ga (qaytish manzili bilan). */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'unknown') return <Spinner className="min-h-screen" />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
