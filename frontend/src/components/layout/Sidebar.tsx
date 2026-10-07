import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { navItemsFor } from '@/config/navigation';
import type { Role } from '@/types';

export function Sidebar({ role }: { role: Role }) {
  const { t } = useTranslation();
  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
      <div className="px-5 py-4 text-lg font-semibold text-blue-700">{t('app.name')}</div>
      <nav aria-label={t('nav.label')}>
        <ul className="space-y-1 px-2">
          {navItemsFor(role).map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `block rounded px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
