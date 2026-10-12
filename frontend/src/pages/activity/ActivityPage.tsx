import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/Pagination';
import { type Column, Table } from '@/components/ui/Table';
import { useActivityLogsQuery } from '@/hooks/useAudit';
import { useAuthStore } from '@/store/authStore';
import type { AuditLogDto } from '@/types';
import { getActionBadge } from '../audit/AuditLogPage';
import { LogDetailsModal } from '../audit/LogDetailsModal';

export function ActivityPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const currentRole = currentUser?.role;

  // activity:view is available to lab_head, director, and admin within the company (D-147, spec §1)
  const isAllowed = currentRole === 'lab_head' || currentRole === 'director' || currentRole === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const queryParams = useMemo(() => {
    return {
      page,
      limit: 15,
      search: search.trim() || undefined,
      action: actionFilter.trim() || undefined,
      tableName: tableFilter.trim() || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    };
  }, [page, search, actionFilter, tableFilter, fromDate, toDate]);

  // Prevent 403: only query if the user has appropriate manager role
  const { data, isLoading } = useActivityLogsQuery(queryParams, isAllowed);

  if (!isAllowed) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {t('errors.forbidden', 'Kirish taqiqlangan')}
        </div>
      </div>
    );
  }

  const logs = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta ?? { page: 1, limit: 15, total: 0 };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('');
    setTableFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const columns: Column<AuditLogDto>[] = [
    {
      key: 'createdAt',
      header: t('activity.table.time', 'Vaqt'),
      render: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('activity.table.user', 'Foydalanuvchi'),
      render: (row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800">
            {row.userFullName ?? (row.userId ? row.userId.slice(0, 8) : t('common.system', 'Tizim'))}
          </div>
          {row.userEmail && <div className="text-slate-400">{row.userEmail}</div>}
        </div>
      ),
    },
    {
      key: 'action',
      header: t('activity.table.action', 'Amal'),
      render: (row) => getActionBadge(row.action),
    },
    {
      key: 'tableName',
      header: t('activity.table.resource', 'Resurs'),
      render: (row) => (
        <span className="font-mono text-xs font-medium text-slate-700">{row.tableName}</span>
      ),
    },
    {
      key: 'recordId',
      header: t('activity.table.recordId', 'ID'),
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {row.recordId ? `${row.recordId.slice(0, 8)}...` : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelectedLog(row);
            setDetailsOpen(true);
          }}
          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('common.details', 'Tafsilot')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('pages.activity', 'Faoliyat jurnali')}</h1>
        <p className="text-sm text-slate-500">
          {t('activity.description', 'Laboratoriya xodimlarining faoliyati va ma\'lumotlar tarixi')}
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('common.search', 'Qidiruv')}
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('activity.filters.searchPlaceholder', 'ID, amal, resurs...')}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('activity.filters.action', 'Amal')}
          </label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('activity.filters.actionPlaceholder', 'create, update...')}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('activity.filters.resource', 'Resurs')}
          </label>
          <input
            type="text"
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('activity.filters.resourcePlaceholder', 'samples, protocols...')}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('activity.filters.from', 'Dan')}
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('activity.filters.to', 'Gacha')}
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleResetFilters}
              title={t('common.reset', 'Tozalash')}
              className="rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
            >
              {t('common.reset', 'Tozalash')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        rows={logs}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyText={t('activity.empty', 'Faoliyat yozuvlari topilmadi')}
      />

      {/* Pagination */}
      {meta.total > meta.limit && (
        <div className="flex justify-center">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}

      {/* Details modal */}
      <LogDetailsModal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedLog(null);
        }}
        log={selectedLog}
      />
    </div>
  );
}
