import { useTranslation } from 'react-i18next';
import { useAnalyticsTeam, usePeriodParam } from '@/hooks/useAnalytics';
import { PageHeader } from '@/ui';
import { PeriodPicker } from './PeriodPicker';
import { TeamTable } from './TeamTable';
import { WorkloadCard } from './WorkloadCard';

/** /team — doiradagi xodimlar jadvali va yuklama (lab_head — o'z jamoasi, director — kompaniya). */
export function TeamPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = usePeriodParam();
  const chemists = useAnalyticsTeam({
    ...period,
    role: 'chemist',
    sort: 'openSamples',
    order: 'desc',
    limit: 100,
  });
  return (
    <>
      <PageHeader title={t('analytics.team')} description={t('analytics.teamDescription')} />
      <div className="mb-4">
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="flex flex-col gap-4">
        <TeamTable period={period} />
        <WorkloadCard
          items={(chemists.data?.data ?? []).map((r) => ({
            userId: r.id,
            fullName: r.fullName,
            open: r.openSamples,
          }))}
          loading={chemists.isLoading}
          error={chemists.isError}
          onRetry={() => void chemists.refetch()}
        />
      </div>
    </>
  );
}
