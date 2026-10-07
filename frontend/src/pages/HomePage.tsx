import { Navigate } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { ComingSoonPage } from './common/ComingSoonPage';

/**
 * `/`: kompaniya rollari uchun dashboard (rolga xos dashboardlar P6 da),
 * super_admin uchun `/companies` (SuperAdminDashboard, D-28).
 */
export function HomePage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'super_admin') return <Navigate to="/companies" replace />;
  return <ComingSoonPage titleKey="pages.dashboard" />;
}
