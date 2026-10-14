import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/ui';

/** Sessiya aniqlanguncha (refresh → /auth/me) ilova karkasi shakli — spinner o'rniga. */
export function AppSkeleton({ variant = 'app' }: { variant?: 'app' | 'auth' }) {
  const { t } = useTranslation();
  const status = (
    <span role="status" className="sr-only">
      {t('common.loading')}
    </span>
  );
  if (variant === 'auth') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
        {status}
        <div className="flex w-full max-w-modal-sm flex-col items-center gap-6">
          <Skeleton variant="rect" className="size-12" />
          <div className="flex w-full flex-col gap-4 rounded-xl border border-line bg-surface p-6">
            <Skeleton className="w-1/2" />
            <Skeleton variant="rect" className="h-9 w-full" />
            <Skeleton variant="rect" className="h-9 w-full" />
            <Skeleton variant="rect" className="h-9 w-full" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-canvas">
      {status}
      <div className="hidden w-sidebar shrink-0 flex-col gap-3 border-r border-line bg-surface p-5 md:flex">
        <Skeleton variant="rect" className="mb-4 h-8 w-32" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rect" className="h-9 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-topbar items-center justify-end gap-3 border-b border-line bg-surface px-6">
          <Skeleton variant="circle" className="size-8" />
          <Skeleton variant="circle" className="size-8" />
        </div>
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          <Skeleton className="h-7 w-48" />
          <Skeleton variant="rect" className="h-14 w-full" />
          <Skeleton variant="rect" className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
