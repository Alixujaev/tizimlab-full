import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useNdListQuery } from '@/hooks/useP17';
import { useAuthStore } from '@/store/authStore';
import type { NdDto, NdStatus } from '@/types/p17';
import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  StatusPill,
  Tabs,
  type Tone,
} from '@/ui';
import { NdFormModal } from './NdFormModal';

export const ND_STATUS_TONE: Record<NdStatus, Tone> = {
  draft: 'warning',
  approved: 'success',
  archived: 'neutral',
};

export function NdStatusPill({ status }: { status: NdStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ND_STATUS_TONE[status]}>{t(`nd.status.${status}`)}</StatusPill>;
}

/** D-176 (TZ §3.2–§3.3): normativ hujjatlar ro'yxati. */
export function NdListPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'lab_head' || role === 'admin';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | NdStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useNdListQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    status: status === 'all' ? undefined : status,
  });

  const columns: DataTableColumn<NdDto>[] = [
    {
      key: 'code',
      header: t('nd.code'),
      primary: true,
      render: (r) => (
        <Link
          to={`/nd/${r.id}`}
          className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
        >
          {r.code}
          {r.version ? ` (${r.version})` : ''}
        </Link>
      ),
    },
    {
      key: 'name',
      header: t('nd.name'),
      render: (r) => (
        <div className="min-w-0">
          <span>{r.name}</span>
          {(r.substanceName || r.series) && (
            <div className="text-xs text-fg-muted">
              {[r.substanceName, r.series].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <NdStatusPill status={r.status} />,
    },
    {
      key: 'reqs',
      header: t('nd.requirementCount'),
      align: 'right',
      hideOnMobile: true,
      render: (r) => <span className="tabular-nums">{r.requirementCount}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nd.title')}
        description={t('nd.subtitle')}
        actions={
          canWrite && (
            <Button leftIcon="plus" onClick={() => setCreateOpen(true)}>
              {t('nd.create')}
            </Button>
          )
        }
      />
      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          aria-label={t('common.search')}
          className="sm:w-72"
        />
        <Tabs
          label={t('ui.filters')}
          className="sm:ml-auto"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          items={[
            { id: 'all', label: t('common.all') },
            { id: 'draft', label: t('nd.status.draft') },
            { id: 'approved', label: t('nd.status.approved') },
            { id: 'archived', label: t('nd.status.archived') },
          ]}
        />
      </FilterBar>
      <div>
        <DataTable
          caption={t('nd.title')}
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="file-text" title={t('nd.empty')} />}
        />
        {data && data.meta.total > data.meta.limit && (
          <Pagination meta={data.meta} onPageChange={setPage} showSummary />
        )}
      </div>
      <NdFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
