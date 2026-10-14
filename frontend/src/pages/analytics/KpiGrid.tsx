import { useTranslation } from 'react-i18next';
import { METRIC_BETTER } from '@/config/analytics';
import type { KpiDto } from '@/types';
import { Badge, MetricInfo, Skeleton, Sparkline, TrendDelta } from '@/ui';
import { useAnalyticsFormat } from './format';

interface KpiGridProps {
  kpis: readonly KpiDto[] | undefined;
  loading?: boolean;
  /** Ko'rsatkich kaliti → trend qiymatlari (sparkline). */
  sparklines?: Record<string, readonly number[]>;
}

/**
 * KPI kartalari: qiymat, oldingi davrga nisbatan ▲▼ foiz, (i) formula izohi, ixtiyoriy sparkline.
 * "Ball/reyting" yo'q — faqat formulali ko'rsatkichlar (D-163).
 */
export function KpiGrid({ kpis, loading = false, sparklines = {} }: KpiGridProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  if (loading && !kpis) {
    return (
      <div role="status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <span className="sr-only">{t('common.loading')}</span>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rect" className="h-28" />
        ))}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(kpis ?? []).map((k) => {
        const label = t(`analytics.metrics.${k.key}.label`);
        const spark = sparklines[k.key];
        return (
          <li
            key={k.key}
            className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-fg-muted">{label}</span>
              <MetricInfo label={t('analytics.formulaFor', { name: label })}>
                {t(`analytics.metrics.${k.key}.formula`)}
              </MetricInfo>
            </div>
            <span
              className="text-2xl font-semibold tabular-nums tracking-tight text-fg"
              data-testid={`kpi-${k.key}`}
            >
              {fmt.value(k.value, k.unit)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {k.snapshot ? (
                <Badge tone="neutral">{t('analytics.snapshot')}</Badge>
              ) : (
                <>
                  <TrendDelta
                    value={k.value}
                    previous={k.previous}
                    better={METRIC_BETTER[k.key] ?? 'none'}
                  />
                  <span className="text-xs text-fg-subtle">
                    {t('analytics.previousValue', { value: fmt.value(k.previous, k.unit) })}
                  </span>
                </>
              )}
            </div>
            {spark && spark.length > 1 && (
              <Sparkline
                values={spark}
                ariaLabel={t('analytics.chartAria.sparkline', { name: label })}
                className="mt-1"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
