import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BarChart, ChartFrame, MetricInfo } from '@/ui';
import { useAnalyticsFormat } from './format';

interface WorkloadCardProps {
  items: { userId: string; fullName: string; open: number }[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

/** Xodim yuklamasi: kimyogar boshidagi ochiq namunalar (snapshot). */
export function WorkloadCard({ items, loading, error, onRetry }: WorkloadCardProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const navigate = useNavigate();
  const sorted = [...items].sort((a, b) => b.open - a.open || a.fullName.localeCompare(b.fullName));
  return (
    <ChartFrame
      title={t('analytics.sections.workload')}
      info={
        <MetricInfo label={t('analytics.formulaFor', { name: t('analytics.sections.workload') })}>
          {t('analytics.metrics.inProgress.formula')}
        </MetricInfo>
      }
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={sorted.length === 0}
      table={{
        headers: [t('analytics.columns.assignee'), t('analytics.columns.openSamples')],
        rows: sorted.map((w) => [w.fullName, fmt.number(w.open)]),
      }}
    >
      <BarChart
        data={sorted.map((w) => ({ key: w.userId, label: w.fullName, value: w.open }))}
        ariaLabel={t('analytics.chartAria.workload')}
        onBarClick={(d) => void navigate(`/team/${d.key}`)}
      />
    </ChartFrame>
  );
}
