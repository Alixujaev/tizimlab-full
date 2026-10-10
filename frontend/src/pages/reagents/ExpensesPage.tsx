import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { useExpensesQuery } from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import type { ReagentExpenseItemDto } from '@/types';

export function ExpensesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(() => searchParams.get('from') ?? '');
  const [to, setTo] = useState(() => searchParams.get('to') ?? '');

  const queryParams = {
    page,
    limit: 20,
    search: search.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading, isError } = useExpensesQuery(queryParams);
  const items = data?.data ?? [];
  const meta = data?.meta;

  const handleResetFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
    setPage(1);
    setSearchParams({});
  };

  const columns: Column<ReagentExpenseItemDto>[] = [
    {
      key: 'date',
      header: t('reagents.recordedDate'),
      render: (row) => <span className="font-medium text-slate-900">{formatDate(row.recordedDate)}</span>,
    },
    {
      key: 'reagent',
      header: t('reagents.name'),
      render: (row) => (
        <Link
          to={`/reagents/${row.reagentId}`}
          className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {row.reagentName}
        </Link>
      ),
    },
    {
      key: 'qty',
      header: t('reagents.outQuantity', 'Chiqim miqdori'),
      render: (row) => (
        <span className="font-bold text-amber-700">
          {row.quantity} {row.unit}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('reagents.responsibleStaff', 'Mas’ul xodim'),
      render: (row) => <span className="text-slate-700">{row.userFullName || '—'}</span>,
    },
    {
      key: 'purpose',
      header: t('reagents.analysisPurpose'),
      render: (row) => (
        <span className="text-xs text-slate-600">{row.analysisPurpose || '—'}</span>
      ),
    },
    {
      key: 'protocol',
      header: t('reagents.protocolId', 'Protokol'),
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.protocolId ? row.protocolId.slice(0, 8) + '...' : '—'}
        </span>
      ),
    },
    {
      key: 'note',
      header: t('reagents.note'),
      render: (row) => <span className="text-xs text-slate-500">{row.note || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sarlavha va Navigatsiya */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/reagents" className="hover:text-indigo-600 hover:underline">
              {t('reagents.title')}
            </Link>
            <span>/</span>
            <span className="text-slate-700">{t('reagents.expenses')}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {t('reagents.expenses')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('reagents.expensesSubtitle', "Barcha reaktivlarning sarf-xarajatlari (chiqimlari) ro'yxati")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/reagents/journal"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t('reagents.expenseLog')}
          </Link>
        </div>
      </div>

      {/* Filtrlar paneli */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-full sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <span>{t('common.from', 'Dan:')}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-600">
            <span>{t('common.to', 'Gacha:')}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {(search || from || to) && (
            <button
              onClick={handleResetFilters}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              {t('common.clear', 'Tozalash')}
            </button>
          )}
        </div>
      </div>

      {/* Jadval */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-indigo-600" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          {t('reagents.expensesFetchError', "Xarajatlar ro'yxatini yuklashda xatolik yuz berdi.")}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          {t('reagents.noExpenses')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table<ReagentExpenseItemDto>
              rows={items}
              columns={columns}
              rowKey={(i: ReagentExpenseItemDto) => i.id}
            />
          </div>
          {meta && meta.total > meta.limit && (
            <Pagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
