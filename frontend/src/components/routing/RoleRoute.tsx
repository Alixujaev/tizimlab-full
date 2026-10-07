import { Outlet } from 'react-router';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types';

/** Faqat ko'rsatilgan rollarga ruxsat; boshqalarga ForbiddenPage. Backend ham alohida tekshiradi. */
export function RoleRoute({ roles }: { roles: readonly Role[] }) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !roles.includes(role)) return <ForbiddenPage />;
  return <Outlet />;
}
