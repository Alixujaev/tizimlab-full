import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/Pagination';
import { type Column, Table } from '@/components/ui/Table';
import { useAuditLogsQuery } from '@/hooks/useAudit';
import { useAuthStore } from '@/store/authStore';
import type { AuditLogDto } from '@/types';
import { LogDetailsModal } from './LogDetailsModal';

export function getActionBadge(action: string) {
  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  if (['create', 'login', 'in'].includes(action)) {
    color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['update', 'status_change', 'assign', 'sign', 'resolve', 'complete', 'record'].includes(action)) {
    color = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (['delete', 'logout', 'revoke', 'disposal'].includes(action)) {
    color = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['alert', 'out', 'adjustment'].includes(action)) {
    color = 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border font-mono ${color}`}>
      {action}
    </span>
  );
}

export function AuditLogPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const isAllowed = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

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

  const { data, isLoading } = useAuditLogsQuery(queryParams, isAllowed);

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
      header: t('audit.table.time'),
      render: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('audit.table.user'),
      render: (row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800">
            {row.userFullName ?? (row.userId ? row.userId.slice(0, 8) : t('common.system', 'Tizim'))}
          </div>
          {row.userEmail && <div className="text-slate-400">{row.userEmail}</div>}
        </div>
      ),
    },
    ...(currentUser?.role === 'super_admin'
      ? [
          {
            key: 'company',
            header: t('audit.table.company'),
            render: (row: AuditLogDto) => (
              <span className="text-xs text-slate-600">
                {row.companyName ?? (row.companyId ? row.companyId.slice(0, 8) : '-')}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'action',
      header: t('audit.table.action'),
      render: (row) => getActionBadge(row.action),
    },
    {
      key: 'tableName',
      header: t('audit.table.resource'),
      render: (row) => (
        <span className="font-mono text-xs font-medium text-slate-700">{row.tableName}</span>
      ),
    },
    {
      key: 'recordId',
      header: t('audit.table.recordId'),
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {row.recordId ? `${row.recordId.slice(0, 8)}...` : '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: t('audit.table.ip'),
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{row.ipAddress ?? '-'}</span>
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
        <h1 className="text-2xl font-bold text-slate-900">{t('pages.auditLog', 'Audit jurnali')}</h1>
        <p className="text-sm text-slate-500">
          {t('audit.description', 'Tizimdagi barcha xavfsizlik va ma\'lumotlar o\'zgarishlari tarixi')}
        </p>
      </div>

      {/* Filters bar */}
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
            placeholder={t('audit.filters.searchPlaceholder', 'ID, amal, resurs...')}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('audit.filters.action', 'Amal')}
          </label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('audit.filters.actionPlaceholder', 'create, update...')}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('audit.filters.resource', 'Resurs')}
          </label>
          <input
            type="text"
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('audit.filters.resourcePlaceholder', 'users, samples...')}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('audit.filters.from', 'Dan')}
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
            {t('audit.filters.to', 'Gacha')}
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
        emptyText={t('audit.empty', 'Audit yozuvlari topilmadi')}
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
