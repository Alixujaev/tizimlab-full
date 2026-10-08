import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import type { Role, UserStatsDto } from '@/types';

interface UserStatsCardsProps {
  stats?: UserStatsDto;
  loading?: boolean;
}

const DISPLAY_ROLES: Role[] = ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin'];

export function UserStatsCards({ stats, loading }: UserStatsCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-6">
        <Spinner />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {t('users.stats.total')}
        </p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
          {t('users.stats.active')}
        </p>
        <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.active}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-rose-600">
          {t('users.stats.inactive')}
        </p>
        <p className="mt-2 text-2xl font-semibold text-rose-700">{stats.inactive}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {t('users.stats.rolesBreakdown')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-600">
          {DISPLAY_ROLES.map((role) => (
            <span
              key={role}
              className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5"
            >
              <span className="font-medium text-slate-700">{t(`users.roles.${role}`)}:</span>
              <span className="ml-1 font-semibold text-slate-900">{stats.byRole[role] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
