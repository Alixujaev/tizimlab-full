import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useLogout } from '@/hooks/useAuth';
import { useLayoutStore } from '@/store/layoutStore';
import type { User } from '@/types';
import { Avatar, IconButton } from '@/ui';
import { BrandMark } from './BrandMark';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

export function TopBar({ user }: { user: User }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const openMobileNav = useLayoutStore((s) => s.setMobileNavOpen);
  const onLogout = () => {
    sessionStorage.setItem('tizimlab.logged_out', 'true');
    logoutMutation.mutate(undefined, {
      onSettled: () => void navigate('/login', { replace: true }),
    });
  };
  return (
    <header className="sticky top-0 z-sticky flex h-topbar shrink-0 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur md:px-6">
      <IconButton
        icon="menu"
        label={t('nav.open')}
        className="md:hidden"
        onClick={() => openMobileNav(true)}
      />
      <span className="md:hidden">
        <BrandMark />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        {user.companyId && <NotificationBell />}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <Link
          to="/profile"
          aria-label={t('topbar.profile')}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors motion-fast focus-ring hover:bg-surface-sunken"
        >
          <Avatar name={user.fullName} size="sm" />
          <span className="hidden max-w-40 truncate text-sm font-medium text-fg lg:block">
            {user.fullName}
          </span>
        </Link>
        <IconButton
          icon="log-out"
          label={t('topbar.logout')}
          loading={logoutMutation.isPending}
          onClick={onLogout}
        />
      </div>
    </header>
  );
}
