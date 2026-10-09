import { useTranslation } from 'react-i18next';
import type { SampleStatus } from '@/types';
import { StatCard } from './StatCard';

const ORDER: SampleStatus[] = [
  'pending_assignment',
  'in_progress',
  'stopped',
  'submitted',
  'approved',
  'rejected',
];

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
  return (
    <section aria-labelledby="dashboard-samples">
      <h2 id="dashboard-samples" className="mb-3 text-lg font-semibold text-slate-800">
        {t(titleKey)} <span className="text-slate-500">({total})</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ORDER.map((s) => (
          <StatCard key={s} label={t(`samples.status.${s}`)} value={counts[s]} to="/samples" />
        ))}
      </div>
    </section>
  );
}
