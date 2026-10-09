import { Navigate } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { DashboardPage } from './dashboard/DashboardPage';

/**
 * `/`: kompaniya rollari uchun rolga xos dashboard (D-33),
 * super_admin uchun `/companies` (SuperAdminDashboard, D-28).
 */
export function HomePage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'super_admin') return <Navigate to="/companies" replace />;
  return <DashboardPage />;
}
