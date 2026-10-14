import { useTranslation } from 'react-i18next';
import { useDashboardQuery } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/authStore';
import { ErrorState, PageHeader, Skeleton } from '@/ui';
import { ChemistDashboard } from './_dashboards/ChemistDashboard';
import { DirectorDashboard } from './_dashboards/DirectorDashboard';
import { InspectorDashboard } from './_dashboards/InspectorDashboard';
import { LabHeadDashboard } from './_dashboards/LabHeadDashboard';

/** Bosh sahifa: backend `view` bo'yicha rolga mos dashboard (D-33; admin — LabHead). */
export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch, isRefetching } = useDashboardQuery();

  return (
    <>
      <PageHeader title={t('pages.dashboard')} description={user?.company?.name} />
      {isLoading && (
        <div role="status" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <span className="sr-only">{t('common.loading')}</span>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="rect" className="h-28" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => void refetch()} retrying={isRefetching} />}
      {data?.view === 'chemist' && <ChemistDashboard data={data} />}
      {data?.view === 'inspector' && <InspectorDashboard data={data} />}
      {data?.view === 'lab_head' && <LabHeadDashboard data={data} />}
      {data?.view === 'director' && <DirectorDashboard data={data} />}
    </>
  );
}
