import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ANALYTICS_ROLES, hasRole } from '@/config/analytics';
import {
  useAnalyticsOverview,
  useAnalyticsTeam,
  usePeriodParam,
  useUserAnalytics,
} from '@/hooks/useAnalytics';
import { useAuthStore } from '@/store/authStore';
import type { AnalyticsOverviewDto, AnalyticsPeriod, LateSampleDto } from '@/types';
import {
  BarChart,
  ButtonLink,
  Card,
  ChartFrame,
  DataTable,
  DonutChart,
  LineChart,
  MetricInfo,
  StatCard,
} from '@/ui';
import { useAnalyticsFormat } from './format';
import { KpiGrid } from './KpiGrid';
import { MemberAnalyticsView } from './MemberAnalyticsView';
import { PeriodPicker } from './PeriodPicker';
import { TeamTable } from './TeamTable';
import { WorkloadCard } from './WorkloadCard';

/**
 * Dashboard'dagi analitika bloki (lazy chunk, D-165): director — kompaniya, lab_head — jamoa,
 * chemist/kontrolyor — "Mening natijalarim". admin va super_admin uchun hech narsa (so'rov ham yo'q).
 */
export default function DashboardAnalytics() {
  const role = useAuthStore((s) => s.user?.role);
  const [period, setPeriod] = usePeriodParam();
  if (!hasRole(ANALYTICS_ROLES, role)) return null;
  return (
    <div className="flex flex-col gap-4">
      <PeriodPicker value={period} onChange={setPeriod} />
      {role === 'director' && <DirectorAnalytics period={period} />}
      {role === 'lab_head' && <LabHeadAnalytics period={period} />}
      {(role === 'chemist' || role === 'kontrolyor') && <MyResultsBlock period={period} />}
    </div>
  );
}

function MyResultsBlock({ period }: { period: AnalyticsPeriod }) {
  const { t } = useTranslation();
  const query = useUserAnalytics('me', period);
  return (
    <section aria-label={t('analytics.myResults')} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">{t('analytics.myResults')}</h2>
        <ButtonLink to="/me" size="sm" variant="ghost" rightIcon="chevron-right">
          {t('analytics.openMyResults')}
        </ButtonLink>
      </div>
      <MemberAnalyticsView
        data={query.data}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => void query.refetch()}
        period={period}
        compact
      />
    </section>
  );
}

function LabHeadAnalytics({ period }: { period: AnalyticsPeriod }) {
  const { t } = useTranslation();
  const me = useUserAnalytics('me', period);
  const chemists = useAnalyticsTeam({
    ...period,
    role: 'chemist',
    sort: 'openSamples',
    order: 'desc',
    limit: 100,
  });
  const queue = me.data?.kpis.filter((k) => k.key.startsWith('queue')) ?? [];
  return (
    <>
      <section aria-label={t('analytics.sections.queue')} className="grid grid-cols-2 gap-3">
        {queue.map((k) => (
          <StatCard
            key={k.key}
            label={t(`analytics.metrics.${k.key}.label`)}
            value={k.value ?? 0}
            to={k.key === 'queueApprovals' ? '/registry' : '/samples'}
            icon={k.key === 'queueApprovals' ? 'shield-check' : 'users'}
            tone="warning"
            highlight={(k.value ?? 0) > 0}
          />
        ))}
      </section>
      <section aria-label={t('analytics.myResults')} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">{t('analytics.myResults')}</h2>
        <KpiGrid
          kpis={me.data?.kpis.filter((k) => !k.key.startsWith('queue'))}
          loading={me.isLoading}
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <TeamTable
          period={period}
          limit={5}
          footer={
            <ButtonLink to="/team" size="sm" variant="ghost" rightIcon="chevron-right">
              {t('analytics.openTeam')}
            </ButtonLink>
          }
        />
        <WorkloadCard
          items={(chemists.data?.data ?? []).map((r) => ({
            userId: r.id,
            fullName: r.fullName,
            open: r.openSamples,
          }))}
          loading={chemists.isLoading}
          error={chemists.isError}
          onRetry={() => void chemists.refetch()}
        />
      </div>
    </>
  );
}

function DirectorAnalytics({ period }: { period: AnalyticsPeriod }) {
  const { t } = useTranslation();
  const query = useAnalyticsOverview(period);
  const data = query.data;
  const state = {
    loading: query.isLoading,
    error: query.isError,
    onRetry: () => void query.refetch(),
  };
  return (
    <>
      <section aria-label={t('analytics.companyAnalytics')} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">{t('analytics.companyAnalytics')}</h2>
        <KpiGrid
          kpis={data?.kpis}
          loading={query.isLoading}
          sparklines={
            data && {
              samplesCreated: data.trend.map((p) => p.created),
              samplesApproved: data.trend.map((p) => p.approved),
            }
          }
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <TrendCard data={data} {...state} />
        <FunnelCard data={data} {...state} />
        <ReasonsCard data={data} {...state} />
        <ByTypeCard data={data} {...state} />
      </div>
      <TeamTable
        period={period}
        limit={5}
        footer={
          <ButtonLink to="/team" size="sm" variant="ghost" rightIcon="chevron-right">
            {t('analytics.openTeam')}
          </ButtonLink>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <LateSamplesCard items={data?.lateSamples ?? []} loading={query.isLoading} />
        <WorkloadCard items={data?.workload ?? []} {...state} />
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label={t('analytics.cards.unresolvedAlerts')}
            value={data.temperature.unresolvedAlerts}
            to="/temperature"
            icon="thermometer"
            tone="danger"
            highlight={data.temperature.unresolvedAlerts > 0}
          />
          <StatCard
            label={t('analytics.cards.alertsInPeriod')}
            value={data.temperature.alertsInPeriod}
            to="/temperature"
            icon="thermometer"
            tone="warning"
          />
          <StatCard
            label={t('analytics.cards.activeStudies')}
            value={data.stability.activeStudies}
            to="/stability"
            icon="clock"
            tone="info"
          />
          <StatCard
            label={t('analytics.cards.overdueCheckpoints')}
            value={data.stability.overdueCheckpoints}
            to="/stability"
            icon="alert-triangle"
            tone="danger"
            highlight={data.stability.overdueCheckpoints > 0}
          />
          <StatCard
            label={t('analytics.cards.dueSoonCheckpoints')}
            value={data.stability.dueSoonCheckpoints}
            to="/stability"
            icon="calendar"
            tone="warning"
          />
        </div>
      )}
    </>
  );
}

interface CardProps {
  data: AnalyticsOverviewDto | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

function TrendCard({ data, loading, error, onRetry }: CardProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const trend = data?.trend ?? [];
  const created = t('analytics.trendSeries.created');
  const approved = t('analytics.trendSeries.approved');
  return (
    <ChartFrame
      title={t('analytics.sections.trend')}
      loading={loading && !data}
      error={error}
      onRetry={onRetry}
      empty={!!data && !trend.some((p) => p.created || p.approved)}
      table={{
        headers: [t('analytics.columns.date'), created, approved],
        rows: trend.map((p) => [
          fmt.isoDate(p.date),
          fmt.number(p.created),
          fmt.number(p.approved),
        ]),
      }}
    >
      <LineChart
        labels={trend.map((p) => p.date)}
        series={[
          { key: 'created', label: created, values: trend.map((p) => p.created) },
          { key: 'approved', label: approved, values: trend.map((p) => p.approved) },
        ]}
        ariaLabel={
          data
            ? t('analytics.chartAria.trend', {
                series: `${created}, ${approved}`,
                bucket: t(`analytics.bucket.${data.period.bucket}`),
                from: fmt.isoDate(data.period.from),
                to: fmt.isoDate(data.period.to),
              })
            : ''
        }
        formatLabel={fmt.shortDate}
      />
    </ChartFrame>
  );
}

function FunnelCard({ data, loading, error, onRetry }: CardProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const funnel = data?.funnel ?? [];
  const start = funnel[0]?.value ?? 0;
  const items = funnel.map((f) => ({
    key: f.key,
    label: t(`analytics.funnel.${f.key}`),
    value: f.value,
    note: start
      ? t('analytics.funnel.ofCreated', { value: fmt.number((f.value / start) * 100) })
      : undefined,
  }));
  return (
    <ChartFrame
      title={t('analytics.sections.funnel')}
      loading={loading && !data}
      error={error}
      onRetry={onRetry}
      empty={!!data && start === 0}
      table={{
        headers: [
          t('analytics.columns.stage'),
          t('analytics.columns.count'),
          t('analytics.columns.share'),
        ],
        rows: items.map((i) => [i.label, fmt.number(i.value), i.note ?? '—']),
      }}
    >
      <BarChart data={items} max={start} ariaLabel={t('analytics.chartAria.funnel')} />
    </ChartFrame>
  );
}

function ReasonsCard({ data, loading, error, onRetry }: CardProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const reasons = (data?.reasons ?? []).map((r) => ({
    key: r.key,
    label:
      r.key === 'unspecified' || r.key === 'other'
        ? t(`analytics.reasons.${r.key}`)
        : (r.label ?? r.key),
    value: r.value,
  }));
  return (
    <ChartFrame
      title={t('analytics.sections.reasons')}
      info={
        <MetricInfo label={t('analytics.formulaFor', { name: t('analytics.sections.reasons') })}>
          {t('analytics.metrics.rejected.formula')}
        </MetricInfo>
      }
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
  );
}

function ByTypeCard({ data, loading, error, onRetry }: CardProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const items = (data?.byType ?? []).map((b) => ({
    key: b.key,
    label: t(`samples.types.${b.key}`),
    value: b.value,
  }));
  return (
    <ChartFrame
      title={t('analytics.sections.byType')}
      loading={loading && !data}
      error={error}
      onRetry={onRetry}
      empty={!!data && items.length === 0}
      table={{
        headers: [t('analytics.columns.type'), t('analytics.columns.count')],
        rows: items.map((i) => [i.label, fmt.number(i.value)]),
      }}
    >
      <BarChart data={items} ariaLabel={t('analytics.chartAria.byType')} colorIndex={2} />
    </ChartFrame>
  );
}

function LateSamplesCard({ items, loading }: { items: LateSampleDto[]; loading: boolean }) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const navigate = useNavigate();
  return (
    <Card
      title={t('analytics.sections.late')}
      actions={
        <MetricInfo label={t('analytics.formulaFor', { name: t('analytics.sections.late') })}>
          {t('analytics.metrics.lateSamples.formula')}
        </MetricInfo>
      }
      flush
    >
      <DataTable
        caption={t('analytics.sections.late')}
        rows={items}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText={t('analytics.noData')}
        onRowClick={(r) => void navigate(`/samples/${r.id}`)}
        columns={[
          {
            key: 'substance',
            header: t('analytics.columns.substance'),
            primary: true,
            render: (r) => <span className="font-medium text-fg">{r.substanceName}</span>,
          },
          {
            key: 'assignee',
            header: t('analytics.columns.assignee'),
            render: (r) => r.assigneeName ?? '—',
          },
          {
            key: 'end',
            header: t('analytics.columns.analysisEnd'),
            render: (r) => fmt.isoDate(r.analysisEnd),
          },
          {
            key: 'late',
            header: t('analytics.columns.daysLate'),
            align: 'right',
            render: (r) => t('analytics.days', { value: fmt.number(r.daysLate) }),
          },
        ]}
      />
    </Card>
  );
}
