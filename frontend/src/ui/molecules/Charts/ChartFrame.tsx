import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import { Skeleton } from '../../atoms/Skeleton';
import { cx } from '../../lib/cx';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

export interface ChartTable {
  headers: string[];
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
}

export interface ChartFrameProps {
  title: ReactNode;
  description?: ReactNode;
  /** Sarlavha yonida — masalan, formula izohi (MetricInfo). */
  info?: ReactNode;
  actions?: ReactNode;
  /** Grafikning matnli muqobili — "Jadval" rejimida ko'rsatiladi. */
  table: ChartTable;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Ma'lumot yo'q — grafik o'rniga EmptyState. */
  empty?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Grafik ramkasi: sarlavha, (i) izoh, "Jadval / Grafik" almashtirgich (har grafikka matnli muqobil),
 * yuklanish, xato va bo'sh holatlar.
 */
export function ChartFrame({
  title,
  description,
  info,
  actions,
  table,
  loading = false,
  error = false,
  onRetry,
  empty = false,
  children,
  className,
}: ChartFrameProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [asTable, setAsTable] = useState(false);
  const ready = !loading && !error && !empty;

  return (
    <section
      aria-labelledby={titleId}
      className={cx('flex flex-col rounded-xl border border-line bg-surface shadow-sm', className)}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 id={titleId} className="text-base font-semibold text-fg">
              {title}
            </h2>
            {info}
          </div>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {ready && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={asTable}
              leftIcon={asTable ? 'activity' : 'layers'}
              onClick={() => setAsTable((v) => !v)}
            >
              {asTable ? t('ui.chart.showChart') : t('ui.chart.showTable')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 px-5 py-4">
        {loading && (
          <div role="status">
            <span className="sr-only">{t('ui.loading')}</span>
            <Skeleton variant="rect" className="h-40" />
          </div>
        )}
        {!loading && error && <ErrorState size="sm" onRetry={onRetry} />}
        {!loading && !error && empty && (
          <EmptyState size="sm" icon="activity" title={t('ui.chart.noData')} />
        )}
        {ready &&
          (asTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-fg-muted">
                    {table.headers.map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={cx('py-2 pr-4 font-medium', i > 0 && 'text-right')}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, r) => (
                    <tr key={r} className="border-b border-line last:border-0">
                      {row.map((cell, c) =>
                        c === 0 ? (
                          <th
                            key={c}
                            scope="row"
                            className="py-2 pr-4 text-left font-normal text-fg"
                          >
                            {cell}
                          </th>
                        ) : (
                          <td key={c} className="py-2 pr-4 text-right tabular-nums text-fg">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            children
          ))}
      </div>
    </section>
  );
}
