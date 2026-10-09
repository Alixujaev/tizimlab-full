import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { useDashboardQuery } from '@/hooks/useDashboard';
import { ChemistDashboard } from './_dashboards/ChemistDashboard';
import { DirectorDashboard } from './_dashboards/DirectorDashboard';
import { InspectorDashboard } from './_dashboards/InspectorDashboard';
import { LabHeadDashboard } from './_dashboards/LabHeadDashboard';

/** Bosh sahifa: backend `view` bo'yicha rolga mos dashboard (D-33; admin — LabHead). */
export function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useDashboardQuery();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('pages.dashboard')}</h1>
      {isLoading && <Spinner />}
      {data?.view === 'chemist' && <ChemistDashboard data={data} />}
      {data?.view === 'inspector' && <InspectorDashboard data={data} />}
      {data?.view === 'lab_head' && <LabHeadDashboard data={data} />}
      {data?.view === 'director' && <DirectorDashboard data={data} />}
    </section>
  );
}
