import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { usePeriodParam, useUserAnalytics } from '@/hooks/useAnalytics';
import { Badge, ErrorState, PageHeader } from '@/ui';
import { MemberAnalyticsView } from './MemberAnalyticsView';
import { PeriodPicker } from './PeriodPicker';

/** /team/:id — xodim kartasi (lab_head, director; ierarxiya backend'da tekshiriladi, D-160). */
export function TeamMemberPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [period, setPeriod] = usePeriodParam();
  const query = useUserAnalytics(id, period);
  const user = query.data?.user;
  return (
    <>
      <PageHeader
        title={user?.fullName ?? t('common.loading')}
        back={{ to: '/team', label: t('analytics.backToTeam') }}
        meta={
          user && (
            <span className="flex items-center gap-2">
              <Badge tone="primary">{t(`users.roles.${user.role}`)}</Badge>
              {!user.isActive && <Badge tone="neutral">{t('analytics.inactive')}</Badge>}
            </span>
          )
        }
      />
      <div className="mb-4">
        <PeriodPicker value={period} onChange={setPeriod} resolved={query.data?.period} />
      </div>
      {query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <MemberAnalyticsView
          data={query.data}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => void query.refetch()}
          period={period}
        />
      )}
    </>
  );
}
