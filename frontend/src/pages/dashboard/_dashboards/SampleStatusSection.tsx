import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleStatus } from '@/types';
import { type IconName, StatCard, type StatCardProps } from '@/ui';

const ORDER: SampleStatus[] = [
  'pending_assignment',
  'in_progress',
  'stopped',
  'submitted',
  'approved',
  'rejected',
];

// Holat → ikon va ohang (namuna statuslari butun ilovada bir xil ranglarda)
const STATUS_VISUAL: Record<
  SampleStatus,
  { icon: IconName; tone: NonNullable<StatCardProps['tone']> }
> = {
  pending_assignment: { icon: 'clock', tone: 'warning' },
  in_progress: { icon: 'flask', tone: 'info' },
  stopped: { icon: 'alert-triangle', tone: 'warning' },
  submitted: { icon: 'send', tone: 'accent' },
  approved: { icon: 'check-circle', tone: 'success' },
  rejected: { icon: 'x-circle', tone: 'danger' },
};

/** Namunalar statuslar bo'yicha (har dashboardda; ko'rinish doirasi rolga mos — backend hal qiladi). */
export function SampleStatusSection({
  titleKey,
  counts,
  total,
}: {
  titleKey: string;
  counts: Record<SampleStatus, number>;
  total: number;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold text-fg">
        {t(titleKey)} <span className="font-normal text-fg-muted">({total})</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ORDER.map((s) => (
          <StatCard
            key={s}
            label={t(`samples.status.${s}`)}
            value={counts[s]}
            to="/samples"
            icon={STATUS_VISUAL[s].icon}
            tone={STATUS_VISUAL[s].tone}
          />
        ))}
      </div>
    </section>
  );
}
