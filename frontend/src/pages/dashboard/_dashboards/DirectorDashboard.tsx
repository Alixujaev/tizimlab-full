import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/types';
import { SampleStatusSection } from './SampleStatusSection';
import { StatCard } from './StatCard';

const OPEN_ORDER = ['draft', 'submitted', 'approved', 'rejected'] as const;

/** D-33: direktor — statuslar bo'yicha umumiy sonlar va yakunlanmagan protokollar. */
export function DirectorDashboard({ data }: { data: Extract<DashboardDto, { view: 'director' }> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <SampleStatusSection
        titleKey="dashboard.companySamples"
        counts={data.samplesByStatus}
        total={data.totalSamples}
      />
      <section aria-labelledby="dashboard-protocols">
        <h2 id="dashboard-protocols" className="mb-3 text-lg font-semibold text-slate-800">
          {t('dashboard.openProtocols')}{' '}
          <span className="text-slate-500">({data.openProtocolsTotal})</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {OPEN_ORDER.map((s) => (
            <StatCard
              key={s}
              label={t(`protocols.status.${s}`)}
              value={data.openProtocolsByStatus[s]}
              to="/registry"
              highlight={s === 'approved'}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
