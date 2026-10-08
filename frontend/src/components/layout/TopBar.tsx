import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useLogout } from '@/hooks/useAuth';
import type { User } from '@/types';
import { LanguageSwitcher } from './LanguageSwitcher';

export function TopBar({ user }: { user: User }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const onLogout = () =>
    logoutMutation.mutate(undefined, {
      onSettled: () => void navigate('/login', { replace: true }),
    });
  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-5">
      <LanguageSwitcher />
      <NotificationBell />
      <Link
        to="/profile"
        className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
        aria-label={t('topbar.profile')}
      >
        {user.fullName}
      </Link>
      <button
        type="button"
        onClick={onLogout}
        disabled={logoutMutation.isPending}
        className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {t('topbar.logout')}
      </button>
    </header>
  );
}
