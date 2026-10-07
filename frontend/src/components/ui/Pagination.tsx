import { useTranslation } from 'react-i18next';
import type { PageMeta } from '@/types';

interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}

/** D-22 `meta: { page, limit, total }` asosida sahifalash. */
export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const btn =
    'rounded border border-slate-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <nav aria-label={t('pagination.label')} className="flex items-center gap-3 py-3">
      <button
        type="button"
        className={btn}
        disabled={meta.page <= 1}
        onClick={() => onPageChange(meta.page - 1)}
      >
        {t('pagination.previous')}
      </button>
      <span className="text-sm text-slate-600">
        {t('pagination.pageOf', { page: meta.page, pages })}
      </span>
      <button
        type="button"
        className={btn}
        disabled={meta.page >= pages}
        onClick={() => onPageChange(meta.page + 1)}
      >
        {t('pagination.next')}
      </button>
    </nav>
  );
}
