import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../atoms/Skeleton';

export interface PageSkeletonProps {
  /** `list` — sarlavha + filtr + jadval; `detail` — sarlavha + mazmun + yon panel; `cards` — dashboard. */
  variant?: 'list' | 'detail' | 'cards';
}

/** Sahifa yuklanishi shakli (spinner o'rniga): sahifa ochilmasdan oldin uning tuzilmasi ko'rinadi. */
export function PageSkeleton({ variant = 'list' }: PageSkeletonProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="w-80 max-w-full" />
      </div>
      {variant === 'list' && (
        <>
          <Skeleton variant="rect" className="h-16 w-full" />
          <Skeleton variant="rect" className="h-80 w-full" />
        </>
      )}
      {variant === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="rect" className="h-28" />
          ))}
        </div>
      )}
      {variant === 'detail' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Skeleton variant="rect" className="h-64" />
            <Skeleton variant="rect" className="h-40" />
          </div>
          <Skeleton variant="rect" className="h-72" />
        </div>
      )}
    </div>
  );
}
