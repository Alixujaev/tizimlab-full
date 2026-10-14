import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useExpensesQuery } from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import type { ReagentExpenseItemDto } from '@/types';
import {
  ButtonLink,
  DataTable,
  type DataTableColumn,
  DatePicker,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
} from '@/ui';

export function ExpensesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(() => searchParams.get('from') ?? '');
  const [to, setTo] = useState(() => searchParams.get('to') ?? '');

  const { data, isLoading, isError, refetch } = useExpensesQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const items = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = !!(search || from || to);

  const resetFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
    setPage(1);
    setSearchParams({});
  };

  const columns: DataTableColumn<ReagentExpenseItemDto>[] = [
    {
      key: 'date',
      header: t('reagents.recordedDate'),
      render: (row) => (
        <span className="font-medium tabular-nums">{formatDate(row.recordedDate)}</span>
      ),
    },
    {
      key: 'reagent',
      header: t('reagents.name'),
      primary: true,
      render: (row) => (
        <Link
          to={`/reagents/${row.reagentId}`}
          className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
        >
          {row.reagentName}
        </Link>
      ),
    },
    {
      key: 'qty',
      header: t('reagents.outQuantity', 'Chiqim miqdori'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-warning-fg">
          {row.quantity} {row.unit}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('reagents.responsibleStaff', 'Mas’ul xodim'),
      render: (row) => <span className="text-fg-muted">{row.userFullName || '—'}</span>,
    },
    {
      key: 'purpose',
      header: t('reagents.analysisPurpose'),
      render: (row) => <span className="text-xs text-fg-muted">{row.analysisPurpose || '—'}</span>,
    },
    {
      key: 'protocol',
      header: t('reagents.protocolId', 'Protokol'),
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-xs text-fg-subtle">
          {row.protocolId ? `${row.protocolId.slice(0, 8)}…` : '—'}
        </span>
      ),
    },
    {
      key: 'note',
      header: t('reagents.note'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-fg-muted">{row.note || '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        back={{ to: '/reagents', label: t('reagents.title') }}
        title={t('reagents.expenses')}
        description={t(
          'reagents.expensesSubtitle',
          "Barcha reaktivlarning sarf-xarajatlari (chiqimlari) ro'yxati",
        )}
        actions={
          <ButtonLink to="/reagents/journal" leftIcon="calendar">
            {t('reagents.expenseLog')}
          </ButtonLink>
        }
      />

      <FilterBar onReset={resetFilters} canReset={hasFilters}>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          aria-label={t('common.search', 'Qidiruv')}
          className="sm:w-72"
        />
        <DatePicker
          aria-label={t('common.from', 'Dan')}
          placeholder={t('common.from', 'Dan')}
          className="sm:w-44"
          value={from}
          max={to || undefined}
          onChange={(v) => {
            setFrom(v);
            setPage(1);
          }}
        />
        <DatePicker
          aria-label={t('common.to', 'Gacha')}
          placeholder={t('common.to', 'Gacha')}
          className="sm:w-44"
          value={to}
          min={from || undefined}
          onChange={(v) => {
            setTo(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('reagents.expenses')}
          columns={columns}
          rows={items}
          rowKey={(i) => i.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="file-text" title={t('reagents.noExpenses')} />}
        />
        {meta && meta.total > meta.limit && (
          <Pagination meta={meta} onPageChange={setPage} showSummary />
        )}
      </div>
    </>
  );
}
