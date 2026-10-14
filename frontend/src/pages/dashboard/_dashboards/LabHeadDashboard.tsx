import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/types';
import { StatCard } from '@/ui';
import { SampleStatusSection } from './SampleStatusSection';

/** D-33: lab_head (va admin) — biriktirish va tasdiq kutayotganlar, kompaniya namunalari. */
export function LabHeadDashboard({ data }: { data: Extract<DashboardDto, { view: 'lab_head' }> }) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <>
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h2 id={headingId} className="text-lg font-semibold text-fg">
          {t('dashboard.needsAttention')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.pendingAssignment')}
            value={data.pendingAssignment}
            to="/samples"
            icon="user"
            tone="warning"
            highlight={data.pendingAssignment > 0}
          />
          <StatCard
            label={t('dashboard.awaitingApproval')}
            value={data.awaitingApproval}
            to="/samples"
            icon="clipboard"
            tone="accent"
            highlight={data.awaitingApproval > 0}
          />
        </div>
      </section>
      <SampleStatusSection
        titleKey="dashboard.companySamples"
        counts={data.samplesByStatus}
        total={data.totalSamples}
      />
    </>
  );
}
