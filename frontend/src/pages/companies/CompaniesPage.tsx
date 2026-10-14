import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useActivateCompanyMutation,
  useCompaniesQuery,
  useDeactivateCompanyMutation,
} from '@/hooks/useCompanies';
import { formatDate } from '@/lib/date';
import type { CompanyDto } from '@/types';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  StatusPill,
} from '@/ui';
import { CompanyConfirmModal } from './CompanyConfirmModal';
import { CompanyFormModal } from './CompanyFormModal';

type ConfirmAction = 'activate' | 'deactivate';

export function CompaniesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDto | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 10,
      search: search.trim() || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'true',
    }),
    [page, search, statusFilter],
  );
  const { data, isLoading, isError, refetch } = useCompaniesQuery(queryParams);
  const activateMutation = useActivateCompanyMutation();
  const deactivateMutation = useDeactivateCompanyMutation();
  const companies = useMemo(() => data?.data ?? [], [data?.data]);

  const stats = useMemo(
    () => ({
      total: data?.meta.total ?? 0,
      active: companies.filter((c) => c.isActive).length,
      inactive: companies.filter((c) => !c.isActive).length,
    }),
    [data?.meta.total, companies],
  );

  const closeConfirm = () => {
    setConfirmAction(null);
    setSelectedCompany(null);
  };

  const handleConfirmAction = () => {
    if (!selectedCompany || !confirmAction) return;
    const mutation = confirmAction === 'activate' ? activateMutation : deactivateMutation;
    mutation.mutate(selectedCompany.id, { onSuccess: closeConfirm });
  };

  const columns: DataTableColumn<CompanyDto>[] = [
    {
      key: 'name',
      header: t('companies.name'),
      primary: true,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium text-fg">{row.name}</span>,
    },
    {
      key: 'slug',
      header: t('companies.slug'),
      render: (row) => (
        <Badge size="sm" className="font-mono">
          {row.slug}
        </Badge>
      ),
    },
    {
      key: 'usersCount',
      header: t('companies.usersCount'),
      align: 'right',
      sortValue: (row) => row.usersCount,
      render: (row) => <span className="tabular-nums text-fg-muted">{row.usersCount}</span>,
    },
    {
      key: 'status',
      header: t('companies.filterStatus'),
      render: (row) => (
        <StatusPill tone={row.isActive ? 'success' : 'danger'}>
          {row.isActive ? t('companies.active') : t('companies.inactive')}
        </StatusPill>
      ),
    },
    {
      key: 'createdAt',
      header: t('companies.createdAt'),
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-fg-muted">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('companies.actions'),
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCompany(row);
              setFormOpen(true);
            }}
          >
            {t('companies.edit')}
          </Button>
          <Button
            variant={row.isActive ? 'danger-ghost' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectedCompany(row);
              setConfirmAction(row.isActive ? 'deactivate' : 'activate');
            }}
          >
            {row.isActive ? t('companies.deactivate') : t('companies.activate')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('companies.title')}
        description={t('companies.subtitle')}
        actions={
          <Button
            leftIcon="plus"
            onClick={() => {
              setSelectedCompany(null);
              setFormOpen(true);
            }}
          >
            {t('companies.createCompany')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('companies.stats.total')} value={stats.total} icon="building" />
        <StatCard
          label={t('companies.stats.active')}
          value={stats.active}
          icon="check-circle"
          tone="success"
        />
        <StatCard
          label={t('companies.stats.inactive')}
          value={stats.inactive}
          icon="x-circle"
          tone="danger"
        />
      </div>

      <FilterBar
        onReset={() => {
          setSearch('');
          setStatusFilter('all');
          setPage(1);
        }}
        canReset={!!search || statusFilter !== 'all'}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('companies.searchPlaceholder')}
          className="sm:w-72"
        />
        <Select
          aria-label={t('companies.filterStatus')}
          className="sm:w-48"
          options={[
            { value: 'all', label: t('companies.allStatuses') },
            { value: 'true', label: t('companies.active') },
            { value: 'false', label: t('companies.inactive') },
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('companies.title')}
          columns={columns}
          rows={companies}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="building" />}
        />
        {data?.meta && data.meta.total > 0 && (
          <Pagination meta={data.meta} onPageChange={setPage} showSummary />
        )}
      </div>

      <CompanyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        company={selectedCompany}
      />
      <CompanyConfirmModal
        open={!!confirmAction}
        onClose={closeConfirm}
        company={selectedCompany}
        action={confirmAction}
        onConfirm={handleConfirmAction}
        loading={activateMutation.isPending || deactivateMutation.isPending}
      />
    </>
  );
}
