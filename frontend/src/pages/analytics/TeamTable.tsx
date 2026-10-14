import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ROLE_METRIC_KEYS } from '@/config/analytics';
import { useAnalyticsTeam } from '@/hooks/useAnalytics';
import { downloadCsv, toCsv } from '@/lib/csv';
import { useAuthStore } from '@/store/authStore';
import type { AnalyticsPeriod, Role, TeamRowDto } from '@/types';
import {
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  MetricInfo,
  Pagination,
  Select,
  type SortState,
} from '@/ui';
import { useAnalyticsFormat } from './format';

const LIMIT = 20;

/** Ko'ruvchi doirasidagi rollar (D-159): director — lab_head ham; lab_head — chemist/kontrolyor. */
export function teamRolesFor(role: Role | undefined): Role[] {
  return role === 'director' ? ['chemist', 'kontrolyor', 'lab_head'] : ['chemist', 'kontrolyor'];
}

interface TeamTableProps {
  period: AnalyticsPeriod;
  /** Dashboard bloki: sahifalashsiz, birinchi 5 qator. */
  limit?: number;
  footer?: React.ReactNode;
}

/** Xodimlar jadvali: rol bo'yicha formulali ustunlar, server saralash, CSV eksport, qator → xodim kartasi. */
export function TeamTable({ period, limit = LIMIT, footer }: TeamTableProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const navigate = useNavigate();
  const viewerRole = useAuthStore((s) => s.user?.role);
  const [role, setRole] = useState<Role>('chemist');
  const [sort, setSort] = useState<SortState | null>({ key: 'fullName', direction: 'asc' });
  const [page, setPage] = useState(1);
  const query = useAnalyticsTeam({
    ...period,
    role,
    sort: sort?.key ?? 'fullName',
    order: sort?.direction ?? 'asc',
    page,
    limit,
  });
  const rows = query.data?.data ?? [];
  const keys = ROLE_METRIC_KEYS[role] ?? [];

  const columns: DataTableColumn<TeamRowDto>[] = [
    {
      key: 'fullName',
      header: t('analytics.columns.name'),
      primary: true,
      sortValue: (r) => r.fullName,
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-fg">{r.fullName}</span>
          {!r.isActive && <Badge tone="neutral">{t('analytics.inactive')}</Badge>}
        </span>
      ),
    },
    ...(role === 'chemist'
      ? [
          {
            key: 'openSamples',
            header: t('analytics.columns.openSamples'),
            align: 'right' as const,
            sortValue: (r: TeamRowDto) => r.openSamples,
            render: (r: TeamRowDto) => fmt.number(r.openSamples),
          },
        ]
      : []),
    ...keys.map<DataTableColumn<TeamRowDto>>((k) => ({
      key: k,
      header: (
        <span className="inline-flex items-center gap-1">
          {t(`analytics.metrics.${k}.label`)}
          <MetricInfo
            label={t('analytics.formulaFor', { name: t(`analytics.metrics.${k}.label`) })}
          >
            {t(`analytics.metrics.${k}.formula`)}
          </MetricInfo>
        </span>
      ),
      align: 'right',
      sortValue: (r) => r.metrics[k] ?? null,
      render: (r) => fmt.metric(k, r.metrics[k] ?? null),
    })),
  ];

  const exportCsv = () =>
    downloadCsv(
      `team-${role}.csv`,
      toCsv(
        [
          t('analytics.columns.name'),
          t('analytics.columns.role'),
          ...(role === 'chemist' ? [t('analytics.columns.openSamples')] : []),
          ...keys.map((k) => t(`analytics.metrics.${k}.label`)),
        ],
        rows.map((r) => [
          r.fullName,
          t(`users.roles.${r.role}`),
          ...(role === 'chemist' ? [r.openSamples] : []),
          ...keys.map((k) => r.metrics[k] ?? ''),
        ]),
      ),
    );

  return (
    <Card
      title={t('analytics.sections.teamTable')}
      flush
      actions={
        <>
          <Select
            size="sm"
            aria-label={t('analytics.filters.role')}
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
              setSort({ key: 'fullName', direction: 'asc' });
            }}
            options={teamRolesFor(viewerRole).map((r) => ({
              value: r,
              label: t(`users.roles.${r}`),
            }))}
          />
          <Button
            size="sm"
            variant="secondary"
            leftIcon="download"
            disabled={!rows.length}
            onClick={exportCsv}
          >
            {t('analytics.exportCsv')}
          </Button>
        </>
      }
      footer={footer}
    >
      <DataTable
        caption={t('analytics.sections.teamTable')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => void query.refetch()}
        emptyText={t('analytics.noData')}
        sort={sort}
        onSortChange={(s) => {
          setSort(s);
          setPage(1);
        }}
        onRowClick={(r) => void navigate(`/team/${r.id}`)}
      />
      {limit === LIMIT && query.data && query.data.meta.total > limit && (
        <div className="border-t border-line px-5 py-3">
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}
