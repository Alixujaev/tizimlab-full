import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { NotificationBell } from '@/components/ui/NotificationBell';
import type { User } from '@/types';
import { LanguageSwitcher } from './LanguageSwitcher';

export function TopBar({ user }: { user: User }) {
  const { t } = useTranslation();
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
    </header>
  );
}
