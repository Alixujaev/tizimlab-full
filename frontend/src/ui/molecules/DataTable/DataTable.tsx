import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../atoms/Icon';
import { Skeleton } from '../../atoms/Skeleton';
import { cx } from '../../lib/cx';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Saralash qiymati; berilsa ustun saralanadi. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Mobil kartaning sarlavhasi (odatda nom/kod ustuni). */
  primary?: boolean;
  /** Mobil kartada ko'rsatilmaydi (masalan, ikkinchi darajali ustunlar). */
  hideOnMobile?: boolean;
}

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Yuklanish skeleti qatorlari soni. */
  skeletonRows?: number;
  error?: boolean;
  onRetry?: () => void;
  /** Bo'sh ro'yxat uchun to'liq EmptyState (yoki faqat matn — `emptyText`). */
  empty?: ReactNode;
  emptyText?: ReactNode;
  /** Jadval nomi (ekran o'quvchilar uchun). */
  caption?: string;
  /** Boshqariladigan saralash (server tomonida). Berilmasa — joriy sahifa ichida saralanadi. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  onRowClick?: (row: T) => void;
  /** Qatorga sichqoncha/fokus kelganda (tafsilotni oldindan yuklash uchun). */
  onRowIntent?: (row: T) => void;
  className?: string;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Ro'yxat jadvali: saralash (`aria-sort`), yopishqoq sarlavha, skelet/bo'sh/xato holatlari,
 * 768px dan tor ekranda karta ko'rinishi.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 5,
  error = false,
  onRetry,
  empty,
  emptyText,
  caption,
  sort: controlledSort,
  onSortChange,
  onRowClick,
  onRowIntent,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const [localSort, setLocalSort] = useState<SortState | null>(null);
  const sort = onSortChange ? (controlledSort ?? null) : localSort;

  const sortedRows = useMemo(() => {
    if (onSortChange || !sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(column.sortValue!(a), column.sortValue!(b)));
  }, [rows, columns, sort, onSortChange]);

  const toggleSort = (key: string) => {
    const next: SortState | null =
      sort?.key !== key
        ? { key, direction: 'asc' }
        : sort.direction === 'asc'
          ? { key, direction: 'desc' }
          : null;
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  const rowProps = (row: T) => ({
    onClick: onRowClick ? () => onRowClick(row) : undefined,
    onKeyDown: onRowClick
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
        }
      : undefined,
    tabIndex: onRowClick ? 0 : undefined,
    onMouseEnter: onRowIntent ? () => onRowIntent(row) : undefined,
    onFocus: onRowIntent ? () => onRowIntent(row) : undefined,
  });

  const loadingStatus = (
    <span role="status" className="sr-only">
      {t('common.loading')}
    </span>
  );

  const shell = cx('overflow-hidden rounded-xl border border-line bg-surface shadow-sm', className);

  if (error) {
    return (
      <div className={shell}>
        <ErrorState onRetry={onRetry} size="sm" />
      </div>
    );
  }

  const isEmpty = !loading && sortedRows.length === 0;
  const emptyNode = empty ?? <EmptyState title={emptyText ?? t('common.noData')} size="sm" />;

  if (!desktop) {
    const primary = columns.find((c) => c.primary) ?? columns[0];
    const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
    return (
      <div className={cx('flex flex-col gap-3', className)} aria-busy={loading || undefined}>
        {loading && loadingStatus}
        {loading &&
          Array.from({ length: Math.min(skeletonRows, 3) }, (_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <Skeleton className="mb-3 w-1/2" />
              <Skeleton lines={3} />
            </div>
          ))}
        {isEmpty && <div className={shell}>{emptyNode}</div>}
        {!loading && sortedRows.length > 0 && (
          <ul aria-label={caption} className="flex flex-col gap-3">
            {sortedRows.map((row) => (
              <li
                key={rowKey(row)}
                {...rowProps(row)}
                className={cx(
                  'animate-fade-in rounded-xl border border-line bg-surface p-4 shadow-sm',
                  onRowClick && 'cursor-pointer focus-ring hover:border-line-strong',
                )}
              >
                {primary && <div className="mb-2 font-medium text-fg">{primary.render(row)}</div>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {rest.map((c) => (
                    <div key={c.key} className="contents">
                      <dt className="text-fg-muted">{c.header}</dt>
                      <dd className="min-w-0 text-right text-fg">{c.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="max-h-table overflow-auto" aria-busy={loading || undefined}>
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key ? sort.direction : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined
                    }
                    className={cx(
                      'sticky top-0 z-sticky whitespace-nowrap border-b border-line bg-surface-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted',
                      alignClass[c.align ?? 'left'],
                      c.className,
                    )}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cx(
                          'inline-flex items-center gap-1 rounded-sm uppercase tracking-wide transition-colors motion-fast focus-ring hover:text-fg',
                          active && 'text-fg',
                        )}
                      >
                        {c.header}
                        <Icon
                          name={
                            active === 'asc'
                              ? 'arrow-up'
                              : active === 'desc'
                                ? 'arrow-down'
                                : 'chevrons-up-down'
                          }
                          size="xs"
                          className={active ? 'text-primary' : 'text-fg-subtle'}
                        />
                        <span className="sr-only">
                          {active === 'asc' ? t('ui.sortDesc') : t('ui.sortAsc')}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((c, ci) => (
                    <td key={c.key} className="border-b border-line px-4 py-3">
                      {i === 0 && ci === 0 && loadingStatus}
                      <Skeleton className={ci === 0 ? 'w-3/4' : 'w-1/2'} />
                    </td>
                  ))}
                </tr>
              ))}
            {isEmpty && (
              <tr>
                <td colSpan={columns.length}>{emptyNode}</td>
              </tr>
            )}
            {!loading &&
              sortedRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  {...rowProps(row)}
                  className={cx(
                    'transition-colors motion-fast hover:bg-surface-muted [&:last-child>td]:border-b-0',
                    onRowClick && 'cursor-pointer focus-ring',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cx(
                        'border-b border-line px-4 py-3 text-fg',
                        alignClass[c.align ?? 'left'],
                        c.className,
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
