import { useTranslation } from 'react-i18next';
import { useRagStatusQuery, useReindexRagMutation, useRetryRagJobMutation } from '@/hooks/useOos';
import { formatDateTime } from '@/lib/date';
import type { RagStatusDto } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  ErrorState,
  notify,
  PageHeader,
  PageSkeleton,
} from '@/ui';

type ChunkRow = RagStatusDto['chunks'][number];
type JobRow = RagStatusDto['jobs'][number];
type FailedRow = RagStatusDto['failed'][number];

/** P19: "Bilim bazasi" — RAG indeks holati, qayta indekslash va xato ishlarni qayta urinish (lab_head/admin). */
export function KnowledgeBasePage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useRagStatusQuery();
  const reindex = useReindexRagMutation();
  const retry = useRetryRagJobMutation();

  if (isLoading) return <PageSkeleton variant="list" />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const sourceLabel = (s: string) => t(`oos.sourceType.${s}`, s);

  const chunkColumns: DataTableColumn<ChunkRow>[] = [
    {
      key: 'type',
      header: t('rag.columns.sourceType'),
      primary: true,
      render: (r) => sourceLabel(r.sourceType),
    },
    { key: 'count', header: t('rag.columns.chunks'), align: 'right', render: (r) => r.count },
    {
      key: 'vec',
      header: t('rag.columns.withEmbedding'),
      align: 'right',
      render: (r) => r.withEmbedding,
    },
  ];
  const jobColumns: DataTableColumn<JobRow>[] = [
    {
      key: 'type',
      header: t('rag.columns.sourceType'),
      primary: true,
      render: (r) => sourceLabel(r.sourceType),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => (
        <Badge
          size="sm"
          tone={r.status === 'failed' ? 'danger' : r.status === 'done' ? 'success' : 'neutral'}
        >
          {t(`rag.jobStatus.${r.status}`, r.status)}
        </Badge>
      ),
    },
    { key: 'count', header: t('rag.columns.count'), align: 'right', render: (r) => r.count },
  ];
  const failedColumns: DataTableColumn<FailedRow>[] = [
    {
      key: 'type',
      header: t('rag.columns.sourceType'),
      primary: true,
      render: (r) => sourceLabel(r.sourceType),
    },
    {
      key: 'error',
      header: t('rag.columns.error'),
      render: (r) => (
        <span className="break-words text-xs text-fg-muted">{r.lastError ?? '—'}</span>
      ),
    },
    {
      key: 'attempts',
      header: t('rag.columns.attempts'),
      align: 'right',
      render: (r) => r.attempts,
    },
    {
      key: 'updated',
      header: t('rag.columns.updatedAt'),
      hideOnMobile: true,
      render: (r) => <span className="tabular-nums">{formatDateTime(r.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          leftIcon="refresh"
          loading={retry.isPending && retry.variables === r.id}
          onClick={() => retry.mutate(r.id, { onSuccess: () => notify.success(t('rag.retried')) })}
        >
          {t('common.retry')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('rag.title')}
        description={t('rag.subtitle')}
        back={{ to: '/oos', label: t('oos.title') }}
        actions={
          <Button
            leftIcon="refresh"
            loading={reindex.isPending}
            onClick={() =>
              reindex.mutate(undefined, {
                onSuccess: (r) => notify.success(t('rag.reindexQueued', { count: r.queued })),
              })
            }
          >
            {t('rag.reindex')}
          </Button>
        }
      />

      <Card title={t('rag.mode.title')}>
        <div className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={data.searchMode === 'hybrid' ? 'success' : 'warning'}>
              {t(`rag.mode.${data.searchMode}`)}
            </Badge>
            {data.embeddingModel && (
              <span className="font-mono text-xs text-fg-muted">{data.embeddingModel}</span>
            )}
          </span>
          {data.searchMode === 'fts_only' && <Alert tone="info">{t('rag.mode.ftsHint')}</Alert>}
        </div>
      </Card>

      <Card title={t('rag.chunksTitle')} flush>
        <DataTable
          columns={chunkColumns}
          rows={data.chunks}
          rowKey={(r) => r.sourceType}
          caption={t('rag.chunksTitle')}
          emptyText={t('rag.emptyChunks')}
        />
      </Card>

      <Card title={t('rag.jobsTitle')} flush>
        <DataTable
          columns={jobColumns}
          rows={data.jobs}
          rowKey={(r) => `${r.sourceType}-${r.status}`}
          caption={t('rag.jobsTitle')}
          emptyText={t('rag.emptyJobs')}
        />
      </Card>

      {data.failed.length > 0 && (
        <Card title={t('rag.failedTitle')} flush>
          <DataTable
            columns={failedColumns}
            rows={data.failed}
            rowKey={(r) => r.id}
            caption={t('rag.failedTitle')}
          />
        </Card>
      )}
    </>
  );
}
