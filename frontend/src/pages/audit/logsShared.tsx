import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuditLogDto } from '@/types';
import {
  Badge,
  Button,
  type DataTableColumn,
  DatePicker,
  FilterBar,
  Input,
  SearchInput,
  type Tone,
} from '@/ui';

/** Amal → ohang (audit va faoliyat jurnalida bir xil). */
export function actionTone(action: string): Tone {
  if (['create', 'login', 'in'].includes(action)) return 'success';
  if (
    ['update', 'status_change', 'assign', 'sign', 'resolve', 'complete', 'record'].includes(action)
  )
    return 'info';
  if (['delete', 'logout', 'revoke', 'disposal'].includes(action)) return 'danger';
  if (['alert', 'out', 'adjustment'].includes(action)) return 'warning';
  return 'neutral';
}

export function ActionBadge({ action }: { action: string }) {
  return (
    <Badge tone={actionTone(action)} className="font-mono">
      {action}
    </Badge>
  );
}

/** Jurnal filtrlari holati va API parametrlari (sahifa raqami filtr o'zgarganda 1 ga qaytadi). */
export function useLogFilters() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [table, setTable] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = useMemo(
    () => ({
      page,
      limit: 15,
      search: search.trim() || undefined,
      action: action.trim() || undefined,
      tableName: table.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, search, action, table, from, to],
  );

  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return {
    params,
    page,
    setPage,
    values: { search, action, table, from, to },
    set: {
      search: withReset(setSearch),
      action: withReset(setAction),
      table: withReset(setTable),
      from: withReset(setFrom),
      to: withReset(setTo),
    },
    hasFilters: !!(search || action || table || from || to),
    reset: () => {
      setSearch('');
      setAction('');
      setTable('');
      setFrom('');
      setTo('');
      setPage(1);
    },
  };
}

type LogFilters = ReturnType<typeof useLogFilters>;

/** Matn kalitlari prefiksi: `audit` yoki `activity`. */
export function LogFilterBar({ filters, ns }: { filters: LogFilters; ns: 'audit' | 'activity' }) {
  const { t } = useTranslation();
  const { values, set } = filters;
  return (
    <FilterBar
      onReset={filters.reset}
      canReset={filters.hasFilters}
      resetLabel={t('common.reset', 'Tozalash')}
    >
      <SearchInput
        value={values.search}
        onChange={set.search}
        placeholder={t(`${ns}.filters.searchPlaceholder`, 'ID, amal, resurs...')}
        aria-label={t('common.search', 'Qidiruv')}
        className="sm:w-64"
      />
      <Input
        aria-label={t(`${ns}.filters.action`, 'Amal')}
        className="sm:w-40"
        value={values.action}
        onChange={(e) => set.action(e.target.value)}
        placeholder={t(`${ns}.filters.actionPlaceholder`, 'create, update...')}
      />
      <Input
        aria-label={t(`${ns}.filters.resource`, 'Resurs')}
        className="sm:w-40"
        value={values.table}
        onChange={(e) => set.table(e.target.value)}
        placeholder={t(`${ns}.filters.resourcePlaceholder`, 'users, samples...')}
      />
      <DatePicker
        aria-label={t(`${ns}.filters.from`, 'Dan')}
        placeholder={t(`${ns}.filters.from`, 'Dan')}
        className="sm:w-40"
        value={values.from}
        max={values.to || undefined}
        onChange={set.from}
      />
      <DatePicker
        aria-label={t(`${ns}.filters.to`, 'Gacha')}
        placeholder={t(`${ns}.filters.to`, 'Gacha')}
        className="sm:w-40"
        value={values.to}
        min={values.from || undefined}
        onChange={set.to}
      />
    </FilterBar>
  );
}

/** Jurnal ustunlari (kompaniya va IP ixtiyoriy). */
export function useLogColumns({
  ns,
  showCompany,
  showIp,
  onDetails,
}: {
  ns: 'audit' | 'activity';
  showCompany: boolean;
  showIp: boolean;
  onDetails: (log: AuditLogDto) => void;
}): DataTableColumn<AuditLogDto>[] {
  const { t } = useTranslation();
  return [
    {
      key: 'createdAt',
      header: t(`${ns}.table.time`, 'Vaqt'),
      render: (row) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user',
      header: t(`${ns}.table.user`, 'Foydalanuvchi'),
      primary: true,
      render: (row) => (
        <div className="min-w-0 text-xs">
          <div className="font-medium text-fg">
            {row.userFullName ??
              (row.userId ? row.userId.slice(0, 8) : t('common.system', 'Tizim'))}
          </div>
          {row.userEmail && <div className="text-fg-subtle">{row.userEmail}</div>}
        </div>
      ),
    },
    ...(showCompany
      ? [
          {
            key: 'company',
            header: t('audit.table.company'),
            render: (row: AuditLogDto) => (
              <span className="text-xs text-fg-muted">
                {row.companyName ?? (row.companyId ? row.companyId.slice(0, 8) : '—')}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'action',
      header: t(`${ns}.table.action`, 'Amal'),
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'tableName',
      header: t(`${ns}.table.resource`, 'Resurs'),
      render: (row) => (
        <span className="font-mono text-xs font-medium text-fg">{row.tableName}</span>
      ),
    },
    {
      key: 'recordId',
      header: t(`${ns}.table.recordId`, 'ID'),
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-xs text-fg-subtle">
          {row.recordId ? `${row.recordId.slice(0, 8)}…` : '—'}
        </span>
      ),
    },
    ...(showIp
      ? [
          {
            key: 'ipAddress',
            header: t('audit.table.ip'),
            hideOnMobile: true,
            render: (row: AuditLogDto) => (
              <span className="font-mono text-xs text-fg-subtle">{row.ipAddress ?? '—'}</span>
            ),
          },
        ]
      : []),
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => onDetails(row)}>
          {t('common.details', 'Tafsilot')}
        </Button>
      ),
    },
  ];
}
