import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMemberSamples } from '@/hooks/useAnalytics';
import { downloadCsv, toCsv } from '@/lib/csv';
import { SampleStatusBadge } from '@/pages/samples/SampleStatusBadge';
import type { AnalyticsPeriod, MemberSampleDto } from '@/types';
import { Badge, Button, Card, DataTable, type DataTableColumn, Pagination, Select } from '@/ui';
import { useAnalyticsFormat } from './format';

const RESULT_TONE = { approved: 'success', rejected: 'danger', open: 'neutral' } as const;
const LIMIT = 10;

/**
 * Xodim ishlagan namunalar: modda, tur, lot/seriya, holat, natija, muddat, rad sababi.
 * Namuna kodi yo'q (D-68, D-84) — namuna tafsilotiga havola orqali ochiladi.
 */
export function MemberSamplesTable({
  userId,
  period,
}: {
  userId: string;
  period: AnalyticsPeriod;
}) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<'' | MemberSampleDto['result']>('');
  const query = useMemberSamples(userId, {
    ...period,
    page,
    limit: LIMIT,
    result: result || undefined,
  });
  const rows = query.data?.data ?? [];

  const columns: DataTableColumn<MemberSampleDto>[] = [
    {
      key: 'substance',
      header: t('analytics.columns.substance'),
      primary: true,
      render: (r) => <span className="font-medium text-fg">{r.substanceName}</span>,
    },
    {
      key: 'type',
      header: t('analytics.columns.type'),
      render: (r) => t(`samples.types.${r.type}`),
    },
    {
      key: 'lot',
      header: t('analytics.columns.lotSerial'),
      hideOnMobile: true,
      render: (r) => [r.lotNumber, r.serialNumber].filter(Boolean).join(' / ') || '—',
    },
    {
      key: 'status',
      header: t('analytics.columns.status'),
      render: (r) => <SampleStatusBadge status={r.status} />,
    },
    {
      key: 'result',
      header: t('analytics.columns.result'),
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={RESULT_TONE[r.result]}>{t(`analytics.result.${r.result}`)}</Badge>
          {r.isLate && <Badge tone="warning">{t('analytics.columns.late')}</Badge>}
        </span>
      ),
    },
    {
      key: 'duration',
      header: t('analytics.columns.duration'),
      align: 'right',
      render: (r) => fmt.value(r.durationHours, 'hours'),
    },
    {
      key: 'reason',
      header: t('analytics.columns.rejectionReason'),
      hideOnMobile: true,
      render: (r) => r.lastRejectionReason ?? '—',
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      'samples.csv',
      toCsv(
        columns.map((c) => String(c.header)),
        rows.map((r) => [
          r.substanceName,
          t(`samples.types.${r.type}`),
          [r.lotNumber, r.serialNumber].filter(Boolean).join(' / '),
          t(`samples.status.${r.status}`),
          t(`analytics.result.${r.result}`),
          r.durationHours ?? '',
          r.lastRejectionReason ?? '',
        ]),
      ),
    );

  return (
    <Card
      title={t('analytics.sections.samples')}
      flush
      actions={
        <>
          <Select
            size="sm"
            aria-label={t('analytics.filters.result')}
            value={result}
            onChange={(v) => {
              setResult(v as typeof result);
              setPage(1);
            }}
            options={[
              { value: '', label: t('analytics.filters.allResults') },
              ...(['approved', 'rejected', 'open'] as const).map((r) => ({
                value: r,
                label: t(`analytics.result.${r}`),
              })),
            ]}
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
    >
      <DataTable
        caption={t('analytics.sections.samples')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => void query.refetch()}
        emptyText={t('analytics.noData')}
        onRowClick={(r) => void navigate(`/samples/${r.id}`)}
      />
      {query.data && query.data.meta.total > LIMIT && (
        <div className="border-t border-line px-5 py-3">
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}
