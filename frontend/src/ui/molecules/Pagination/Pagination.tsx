import { useTranslation } from 'react-i18next';
import type { PageMeta } from '@/types';
import { Button } from '../../atoms/Button';
import { cx } from '../../lib/cx';

export interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  /** "Jami N tadan X–Y ko'rsatilmoqda" qatori. */
  showSummary?: boolean;
  className?: string;
}

/** D-22 `meta: { page, limit, total }` asosida sahifalash. */
export function Pagination({
  meta,
  onPageChange,
  showSummary = false,
  className,
}: PaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <nav
      aria-label={t('pagination.label')}
      className={cx('flex flex-wrap items-center justify-between gap-3 py-3', className)}
    >
      {showSummary ? (
        <span className="text-sm text-fg-muted">
          {t('common.paginationInfo', { total: meta.total, from, to })}
        </span>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon="chevron-left"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          {t('pagination.previous')}
        </Button>
        <span
          className="min-w-14 text-center text-sm tabular-nums text-fg-muted"
          aria-live="polite"
        >
          {t('pagination.pageOf', { page: meta.page, pages })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          rightIcon="chevron-right"
          disabled={meta.page >= pages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </nav>
  );
}
