import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { type Column, Table } from '@/components/ui/Table';
import {
  useActivateCompanyMutation,
  useCompaniesQuery,
  useDeactivateCompanyMutation,
} from '@/hooks/useCompanies';
import type { CompanyDto } from '@/types';
import { CompanyConfirmModal } from './CompanyConfirmModal';
import { CompanyFormModal } from './CompanyFormModal';

export function CompaniesPage() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDto | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate' | null>(null);

  const queryParams = useMemo(() => {
    return {
      page,
      limit: 10,
      search: search.trim() || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'true',
    };
  }, [page, search, statusFilter]);

  const { data, isLoading } = useCompaniesQuery(queryParams);
  const activateMutation = useActivateCompanyMutation();
  const deactivateMutation = useDeactivateCompanyMutation();

  const handleOpenCreate = () => {
    setSelectedCompany(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (company: CompanyDto) => {
    setSelectedCompany(company);
    setFormOpen(true);
  };

  const handleOpenConfirm = (company: CompanyDto, action: 'activate' | 'deactivate') => {
    setSelectedCompany(company);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleConfirmAction = () => {
    if (!selectedCompany || !confirmAction) return;

    if (confirmAction === 'activate') {
      activateMutation.mutate(selectedCompany.id, {
        onSuccess: () => {
          setConfirmOpen(false);
          setSelectedCompany(null);
          setConfirmAction(null);
        },
      });
    } else {
      deactivateMutation.mutate(selectedCompany.id, {
        onSuccess: () => {
          setConfirmOpen(false);
          setSelectedCompany(null);
          setConfirmAction(null);
        },
      });
    }
  };

  const companies = useMemo(() => data?.data ?? [], [data?.data]);

  const stats = useMemo(() => {
    const total = data?.meta.total ?? 0;
    const active = companies.filter((c) => c.isActive).length;
    const inactive = companies.filter((c) => !c.isActive).length;
    return { total, active, inactive };
  }, [data?.meta.total, companies]);

  const columns: Column<CompanyDto>[] = [
    {
      key: 'name',
      header: t('companies.name'),
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      key: 'slug',
      header: t('companies.slug'),
      render: (row) => (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
          {row.slug}
        </code>
      ),
    },
    {
      key: 'usersCount',
      header: t('companies.usersCount'),
      render: (row) => <span className="text-slate-600">{row.usersCount}</span>,
    },
    {
      key: 'status',
      header: t('companies.filterStatus'),
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {row.isActive ? t('companies.active') : t('companies.inactive')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('companies.createdAt'),
      render: (row) => (
        <span className="text-slate-500">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('companies.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('companies.edit')}
          </button>
          {row.isActive ? (
            <button
              type="button"
              onClick={() => handleOpenConfirm(row, 'deactivate')}
              className="rounded border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              {t('companies.deactivate')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenConfirm(row, 'activate')}
              className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              {t('companies.activate')}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('companies.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('companies.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {t('companies.createCompany')}
        </button>
      </div>

      {/* Minimal dashboard statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t('companies.stats.total')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
            {t('companies.stats.active')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-rose-600">
            {t('companies.stats.inactive')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{stats.inactive}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('companies.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'true' | 'false');
              setPage(1);
            }}
            aria-label={t('companies.filterStatus')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">{t('companies.allStatuses')}</option>
            <option value="true">{t('companies.active')}</option>
            <option value="false">{t('companies.inactive')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            rows={companies}
            rowKey={(r) => r.id}
          />
          {data?.meta && data.meta.total > 0 && (
            <div className="flex justify-end">
              <Pagination meta={data.meta} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CompanyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        company={selectedCompany}
      />
      <CompanyConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        company={selectedCompany}
        action={confirmAction}
        onConfirm={handleConfirmAction}
        loading={activateMutation.isPending || deactivateMutation.isPending}
      />
    </div>
  );
}
