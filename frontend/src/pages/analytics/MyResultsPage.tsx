import { useTranslation } from 'react-i18next';
import { usePeriodParam, useUserAnalytics } from '@/hooks/useAnalytics';
import { PageHeader } from '@/ui';
import { MemberAnalyticsView } from './MemberAnalyticsView';
import { PeriodPicker } from './PeriodPicker';

/** /me — har bir analitika roli o'z ko'rsatkichlarini ko'radi (D-165). */
export function MyResultsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = usePeriodParam();
  const query = useUserAnalytics('me', period);
  return (
    <>
      <PageHeader
        title={t('analytics.myResults')}
        description={t('analytics.myResultsDescription')}
      />
      <div className="mb-4">
        <PeriodPicker value={period} onChange={setPeriod} resolved={query.data?.period} />
      </div>
      <MemberAnalyticsView
        data={query.data}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => void query.refetch()}
        period={period}
      />
    </>
  );
}
