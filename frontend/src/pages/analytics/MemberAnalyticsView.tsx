import { useTranslation } from 'react-i18next';
import type { AnalyticsPeriod, UserAnalyticsDto } from '@/types';
import { ChartFrame, DonutChart, EmptyState, Heatmap, LineChart, StackedBar } from '@/ui';
import { useAnalyticsFormat } from './format';
import { KpiGrid } from './KpiGrid';
import { MemberSamplesTable } from './MemberSamplesTable';

interface MemberAnalyticsViewProps {
  data: UserAnalyticsDto | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  period: AnalyticsPeriod;
  /** Ixcham ko'rinish (dashboard bloki): faqat KPI va trend. */
  compact?: boolean;
}

/** Bitta xodim analitikasi: KPI, trend, natijalar taqsimoti, rad sabablari, namunalar, faoliyat. */
export function MemberAnalyticsView({
  data,
  loading,
  error,
  onRetry,
  period,
  compact = false,
}: MemberAnalyticsViewProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const points = data?.trend.points ?? [];
  const seriesLabel = t(`analytics.trendSeries.${data?.trend.key ?? 'none'}`);
  const trendKpi = data?.kpis.find((k) => k.key === data.trend.key)?.key;
  const outcomes = (data?.outcomes ?? []).map((o) => ({
    key: o.key,
    label: t(`analytics.outcomes.${o.key}`),
    value: o.value,
  }));
  const reasons = (data?.reasons ?? []).map((r) => ({
    key: r.key,
    label:
      r.key === 'unspecified' || r.key === 'other'
        ? t(`analytics.reasons.${r.key}`)
        : (r.label ?? r.key),
    value: r.value,
  }));
  const trendEmpty = !points.some((p) => p.value > 0);
  const aria = data
    ? t('analytics.chartAria.trend', {
        series: seriesLabel,
        bucket: t(`analytics.bucket.${data.period.bucket}`),
        from: fmt.isoDate(data.period.from),
        to: fmt.isoDate(data.period.to),
      })
    : '';

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={t('analytics.sections.kpis')}>
        <KpiGrid
          kpis={data?.kpis}
          loading={loading}
          sparklines={trendKpi ? { [trendKpi]: points.map((p) => p.value) } : undefined}
        />
      </section>
      <div className={compact ? 'grid gap-4' : 'grid gap-4 xl:grid-cols-2'}>
        <ChartFrame
          title={`${t('analytics.sections.trend')}: ${seriesLabel}`}
          loading={loading && !data}
          error={error}
          onRetry={onRetry}
          empty={!!data && trendEmpty}
          table={{
            headers: [t('analytics.columns.date'), seriesLabel],
            rows: points.map((p) => [fmt.isoDate(p.date), fmt.number(p.value)]),
          }}
        >
          <LineChart
            labels={points.map((p) => p.date)}
            series={[{ key: 'value', label: seriesLabel, values: points.map((p) => p.value) }]}
            ariaLabel={aria}
            formatLabel={fmt.shortDate}
          />
        </ChartFrame>
        {!compact && data?.period.bucket === 'day' && (
          <ChartFrame
            title={t('analytics.sections.heatmap')}
            empty={trendEmpty}
            table={{
              headers: [t('analytics.columns.date'), seriesLabel],
              rows: points.map((p) => [fmt.isoDate(p.date), fmt.number(p.value)]),
            }}
          >
            <Heatmap
              days={points}
              ariaLabel={t('analytics.chartAria.heatmap')}
              formatDate={fmt.isoDate}
            />
          </ChartFrame>
        )}
        {!compact && (
          <ChartFrame
            title={t('analytics.sections.outcomes')}
            loading={loading && !data}
            error={error}
            onRetry={onRetry}
            empty={!!data && !outcomes.some((o) => o.value > 0)}
            table={{
              headers: [t('analytics.columns.result'), t('analytics.columns.count')],
              rows: outcomes.map((o) => [o.label, fmt.number(o.value)]),
            }}
          >
            <StackedBar data={outcomes} ariaLabel={t('analytics.chartAria.outcomes')} />
          </ChartFrame>
        )}
        {!compact && (
          <ChartFrame
            title={t('analytics.sections.reasons')}
            loading={loading && !data}
            error={error}
            onRetry={onRetry}
            empty={!!data && reasons.length === 0}
            table={{
              headers: [t('analytics.columns.reason'), t('analytics.columns.count')],
              rows: reasons.map((r) => [r.label, fmt.number(r.value)]),
            }}
          >
            <DonutChart
              data={reasons}
              ariaLabel={t('analytics.chartAria.reasons')}
              centerLabel={t('analytics.total')}
              otherLabel={t('analytics.other')}
            />
          </ChartFrame>
        )}
      </div>
      {!compact && data && (
        <>
          <MemberSamplesTable userId={data.user.id} period={period} />
          <section
            aria-label={t('analytics.sections.activity')}
            className="rounded-xl border border-line bg-surface p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-fg">{t('analytics.sections.activity')}</h2>
            {data.activity.length === 0 ? (
              <EmptyState size="sm" title={t('analytics.activity.empty')} />
            ) : (
              <ol className="mt-3 flex flex-col divide-y divide-line">
                {data.activity.map((a, i) => (
                  <li
                    key={`${a.at}-${i}`}
                    className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm"
                  >
                    <span className="w-36 shrink-0 tabular-nums text-fg-muted">
                      {fmt.dateTime(a.at)}
                    </span>
                    <span className="text-fg">{t(`analytics.activity.${a.action}`, a.action)}</span>
                    {a.substanceName && <span className="text-fg-muted">{a.substanceName}</span>}
                    {a.reason && <span className="text-xs text-fg-subtle">— {a.reason}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
