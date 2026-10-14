import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { navItemsFor } from '@/config/navigation';
import { useLayoutStore } from '@/store/layoutStore';
import type { Role } from '@/types';
import { cx, Icon, IconButton, Tooltip } from '@/ui';
import { BrandMark } from './BrandMark';

interface SidebarNavProps {
  role: Role;
  collapsed?: boolean;
  /** Havola bosilgandan keyin (mobil drawer'ni yopish). */
  onNavigate?: () => void;
}

/** Rolga mos menyu (D-28): desktop sidebar va mobil drawer'da bir xil. */
export function SidebarNav({ role, collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.label')} className="px-3">
      <ul className="flex flex-col gap-0.5">
        {navItemsFor(role).map((item) => {
          const label = t(item.labelKey);
          const link = (
            <NavLink
              to={item.path}
              end={item.path === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors motion-fast focus-ring',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary-subtle font-medium text-primary-subtle-fg before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-primary'
                    : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
                )
              }
            >
              <Icon name={item.icon} size="md" />
              <span className={cx('truncate', collapsed && 'sr-only')}>{label}</span>
            </NavLink>
          );
          return (
            <li key={item.key}>{collapsed ? <Tooltip content={label}>{link}</Tooltip> : link}</li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop sidebar (md+): ixchamlashadi, tanlov saqlanadi. Mobil'da — AppLayout'dagi Drawer. */
export function Sidebar({ role }: { role: Role }) {
  const { t } = useTranslation();
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggle = useLayoutStore((s) => s.toggleSidebar);
  return (
    <aside
      className={cx(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface md:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <div
        className={cx(
          'flex h-topbar shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        <BrandMark compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav role={role} collapsed={collapsed} />
      </div>
      <div className={cx('border-t border-line p-3', collapsed && 'flex justify-center')}>
        <IconButton
          icon="panel-left"
          label={collapsed ? t('nav.expand') : t('nav.collapse')}
          aria-expanded={!collapsed}
          onClick={toggle}
        />
      </div>
    </aside>
  );
}
