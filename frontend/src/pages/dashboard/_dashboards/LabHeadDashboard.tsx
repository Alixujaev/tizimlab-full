import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/types';
import { SampleStatusSection } from './SampleStatusSection';
import { StatCard } from './StatCard';

/**
 * D-33: lab_head (va admin) — biriktirish va tasdiq kutayotganlar. Harorat alertlari, `low_stock`,
 * `is_expired` va stabilizatsiya muddatlari kartalari tegishli modullar (P7–P9) bilan qo'shiladi.
 */
export function LabHeadDashboard({ data }: { data: Extract<DashboardDto, { view: 'lab_head' }> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <section aria-labelledby="dashboard-attention">
        <h2 id="dashboard-attention" className="mb-3 text-lg font-semibold text-slate-800">
          {t('dashboard.needsAttention')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.pendingAssignment')}
            value={data.pendingAssignment}
            to="/samples"
            highlight
          />
          <StatCard
            label={t('dashboard.awaitingApproval')}
            value={data.awaitingApproval}
            to="/samples"
            highlight
          />
        </div>
      </section>
      <SampleStatusSection
        titleKey="dashboard.companySamples"
        counts={data.samplesByStatus}
        total={data.totalSamples}
      />
    </div>
  );
}
