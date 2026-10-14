import { useTranslation } from 'react-i18next';
import type { Role, UserStatsDto } from '@/types';
import { Badge, Card, Skeleton, StatCard } from '@/ui';

interface UserStatsCardsProps {
  stats?: UserStatsDto;
  loading?: boolean;
}

const DISPLAY_ROLES: Role[] = ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin'];

export function UserStatsCards({ stats, loading }: UserStatsCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <span className="sr-only">{t('common.loading')}</span>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rect" className="h-28" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t('users.stats.total')} value={stats.total} icon="users" />
      <StatCard
        label={t('users.stats.active')}
        value={stats.active}
        icon="check-circle"
        tone="success"
      />
      <StatCard
        label={t('users.stats.inactive')}
        value={stats.inactive}
        icon="x-circle"
        tone="danger"
      />
      <Card>
        <p className="text-sm font-medium text-fg-muted">{t('users.stats.rolesBreakdown')}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DISPLAY_ROLES.map((role) => (
            <Badge key={role}>
              {t(`users.roles.${role}`)}:{' '}
              <span className="font-semibold text-fg">{stats.byRole[role] ?? 0}</span>
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
