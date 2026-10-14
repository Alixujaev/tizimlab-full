import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useDeleteReagentMutation, useReagentsQuery } from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { ReagentDto } from '@/types';
import {
  Alert,
  Button,
  ButtonLink,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Tabs,
} from '@/ui';
import { ReagentFormModal } from './ReagentFormModal';
import { ReagentStatusBadges } from './ReagentStatusBadges';

type QuickFilter = 'all' | 'lowStock' | 'expired' | 'hazardous';

export function ReagentsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canWrite = user?.role === 'admin' || user?.role === 'lab_head';
  const canDelete = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<QuickFilter>('all');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingReagent, setEditingReagent] = useState<ReagentDto | null>(null);
  const [reagentToDelete, setReagentToDelete] = useState<ReagentDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteReagentMutation();

  const { data, isLoading, isError, refetch } = useReagentsQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    isLowStock: filterType === 'lowStock' ? true : undefined,
    isExpired: filterType === 'expired' ? true : undefined,
    isHazardous: filterType === 'hazardous' ? true : undefined,
  });
  const reagents = data?.data ?? [];
  const meta = data?.meta;

  const handleDeleteConfirm = async () => {
    if (!reagentToDelete) return;
    try {
      await deleteMutation.mutateAsync(reagentToDelete.id);
      setReagentToDelete(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  };

  const columns: DataTableColumn<ReagentDto>[] = [
    {
      key: 'name',
      header: t('reagents.name'),
      primary: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/reagents/${row.id}`}
            className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
          >
            {row.name}
          </Link>
          {row.casNumber && (
            <div className="text-xs text-fg-muted">
              {t('reagents.casPrefix', 'CAS:')} {row.casNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: t('reagents.quantity'),
      align: 'right',
      sortValue: (row) => row.quantity,
      render: (row) => (
        <span className="font-semibold tabular-nums text-fg">
          {row.quantity} <span className="font-normal text-fg-muted">{row.unit}</span>
        </span>
      ),
    },
    {
      key: 'threshold',
      header: t('reagents.lowStockThreshold'),
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-fg-muted">
          {row.lowStockThreshold} {row.unit}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status', 'Holati'),
      render: (row) => <ReagentStatusBadges reagent={row} />,
    },
    {
      key: 'expiresAt',
      header: t('reagents.expiresAt'),
      sortValue: (row) => row.expiresAt ?? '',
      render: (row) => (
        <span
          className={row.isExpired ? 'font-medium text-danger-fg' : 'tabular-nums text-fg-muted'}
        >
          {formatDate(row.expiresAt)}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: t('reagents.supplier'),
      hideOnMobile: true,
      render: (row) => <span className="text-fg-muted">{row.supplier || '—'}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions', 'Amallar'),
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <ButtonLink to={`/reagents/${row.id}`} variant="ghost" size="sm">
            {t('common.detail', 'Batafsil')}
          </ButtonLink>
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingReagent(row);
                setFormModalOpen(true);
              }}
            >
              {t('common.edit', 'Tahrirlash')}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                setReagentToDelete(row);
              }}
            >
              {t('common.delete', "O'chirish")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('reagents.title')}
        description={t(
          'reagents.subtitle',
          'Laboratoriya kimyoviy moddalari zaxirasi va xarajatlari',
        )}
        actions={
          <>
            <ButtonLink to="/reagents/journal" leftIcon="calendar">
              {t('reagents.expenseLog')}
            </ButtonLink>
            <ButtonLink to="/expenses" leftIcon="file-text">
              {t('reagents.expenses')}
            </ButtonLink>
            {canWrite && (
              <Button
                leftIcon="plus"
                onClick={() => {
                  setEditingReagent(null);
                  setFormModalOpen(true);
                }}
              >
                {t('reagents.create')}
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          aria-label={t('common.search', 'Qidiruv')}
          className="sm:w-72"
        />
        <Tabs
          label={t('ui.filters')}
          className="sm:ml-auto"
          value={filterType}
          onChange={(v) => {
            setFilterType(v);
            setPage(1);
          }}
          items={[
            { id: 'all', label: t('reagents.all', 'Barchasi') },
            { id: 'lowStock', label: t('reagents.filterLowStock', 'Kam qolganlar') },
            { id: 'expired', label: t('reagents.filterExpired', "Muddati o'tganlar") },
            { id: 'hazardous', label: t('reagents.filterHazardous', 'Xavflilar') },
          ]}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('reagents.title')}
          columns={columns}
          rows={reagents}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="beaker" title={t('reagents.noReagents')} />}
        />
        {meta && meta.total > meta.limit && (
          <Pagination meta={meta} onPageChange={setPage} showSummary />
        )}
      </div>

      <ReagentFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        reagent={editingReagent}
      />

      <ConfirmDialog
        open={!!reagentToDelete}
        title={t('reagents.delete')}
        description={t(
          'reagents.deleteConfirm',
          "Haqiqatan ham bu reaktivni o'chirmoqchimisiz? (Tranzaksiyasi bor reaktivni o'chirib bo'lmaydi).",
        )}
        confirmLabel={t('common.delete', "O'chirish")}
        cancelLabel={t('common.cancel', 'Bekor qilish')}
        loading={deleteMutation.isPending}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setReagentToDelete(null)}
      >
        {deleteError ? <Alert tone="danger">{deleteError}</Alert> : undefined}
      </ConfirmDialog>
    </>
  );
}
