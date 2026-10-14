import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/types';
import { type IconName, StatCard, type StatCardProps } from '@/ui';
import { SampleStatusSection } from './SampleStatusSection';

const OPEN_ORDER = ['draft', 'submitted', 'approved', 'rejected'] as const;
const PROTOCOL_VISUAL: Record<
  (typeof OPEN_ORDER)[number],
  { icon: IconName; tone: NonNullable<StatCardProps['tone']> }
> = {
  draft: { icon: 'file-text', tone: 'info' },
  submitted: { icon: 'send', tone: 'warning' },
  approved: { icon: 'shield-check', tone: 'success' },
  rejected: { icon: 'x-circle', tone: 'danger' },
};

/** D-33: direktor — statuslar bo'yicha umumiy sonlar va yakunlanmagan protokollar. */
export function DirectorDashboard({ data }: { data: Extract<DashboardDto, { view: 'director' }> }) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <>
      <SampleStatusSection
        titleKey="dashboard.companySamples"
        counts={data.samplesByStatus}
        total={data.totalSamples}
      />
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h2 id={headingId} className="text-lg font-semibold text-fg">
          {t('dashboard.openProtocols')}{' '}
          <span className="font-normal text-fg-muted">({data.openProtocolsTotal})</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {OPEN_ORDER.map((s) => (
            <StatCard
              key={s}
              label={t(`protocols.status.${s}`)}
              value={data.openProtocolsByStatus[s]}
              to="/registry"
              icon={PROTOCOL_VISUAL[s].icon}
              tone={PROTOCOL_VISUAL[s].tone}
              // Direktor yakunlashi kerak bo'lgan (tasdiqlangan) protokollar ajratiladi
              highlight={s === 'approved' && data.openProtocolsByStatus[s] > 0}
            />
          ))}
        </div>
      </section>
    </>
  );
}
