import { Outlet } from 'react-router';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Himoyalangan sahifalar uchun umumiy karkas (ProtectedRoute ichida ishlatiladi). */
export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  useNotificationSocket();
  if (!user) return null;
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
