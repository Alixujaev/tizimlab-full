import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useStabilityStudiesQuery } from '@/hooks/useStability';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { StabilityStudyDto, StabilityStudyStatus } from '@/types';
import {
  Button,
  ButtonLink,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Tabs,
} from '@/ui';
import { CreateStudyModal } from './CreateStudyModal';
import { StudyStatusBadge } from './StabilityStatusBadge';

export function StabilityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canStart = role === 'lab_head' || role === 'director' || role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StabilityStudyStatus | ''>('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useStabilityStudiesQuery({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    page,
    limit: 20,
  });
  const studies = data?.items ?? [];
  const meta = data?.meta;

  const columns: DataTableColumn<StabilityStudyDto>[] = [
    {
      key: 'substance',
      header: t('stability.substanceName'),
      primary: true,
      render: (s) => (
        <Link
          to={`/stability/${s.id}`}
          className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
        >
          {s.substanceName}
        </Link>
      ),
    },
    {
      key: 'serial',
      header: t('stability.serialNumber'),
      render: (s) => <span className="font-mono text-xs">{s.serialNumber || '—'}</span>,
    },
    {
      key: 'startedAt',
      header: t('stability.startedAt'),
      render: (s) => <span className="tabular-nums">{formatDate(s.startedAt)}</span>,
    },
    {
      key: 'storage',
      header: t('stability.storageConditions'),
      hideOnMobile: true,
      render: (s) => <span className="text-xs text-fg-muted">{s.storageConditions || '—'}</span>,
    },
    {
      key: 'checkpoints',
      header: t('stability.checkpoints'),
      render: (s) => (
        <span className="tabular-nums text-sm">
          <strong className="text-success-fg">{s.completedCheckpoints}</strong> /{' '}
          {s.totalCheckpoints}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('stability.status'),
      render: (s) => <StudyStatusBadge status={s.status} />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (s) => (
        <ButtonLink to={`/stability/${s.id}`} variant="ghost" size="sm" rightIcon="chevron-right">
          {t('common.view')}
        </ButtonLink>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('stability.title')}
        description={t('stability.subtitle')}
        actions={
          canStart && (
            <Button leftIcon="plus" onClick={() => setCreateModalOpen(true)}>
              {t('stability.newStudy')}
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
          placeholder={t('stability.search')}
          className="sm:w-80"
        />
        <Tabs
          label={t('stability.status')}
          className="sm:ml-auto"
          value={statusFilter || 'all'}
          onChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
          items={[
            { id: 'all' as const, label: t('stability.all') },
            { id: 'active' as const, label: t('stability.active') },
            { id: 'completed' as const, label: t('stability.completed') },
          ]}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('stability.title')}
          columns={columns}
          rows={studies}
          rowKey={(s) => s.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="clock" title={t('stability.noStudies')} />}
        />
        {meta && meta.total > meta.limit && (
          <Pagination meta={meta} onPageChange={setPage} showSummary />
        )}
      </div>

      {createModalOpen && (
        <CreateStudyModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(id) => navigate(`/stability/${id}`)}
        />
      )}
    </>
  );
}
