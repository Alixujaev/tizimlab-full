import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';

const sizes = {
  xs: 'size-3.5 border-2',
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-2',
} as const;

export interface SpinnerProps {
  size?: keyof typeof sizes;
  /** Ichki (inline) ko'rinish — atrofida bo'shliq va `role=status` yo'q (masalan, tugma ichida). */
  inline?: boolean;
  label?: string;
  className?: string;
}

/** Qisqa amal kutilganda (tugma, kichik blok). Sahifa/ro'yxat yuklanishi uchun — Skeleton. */
export function Spinner({ size = 'md', inline = false, label, className }: SpinnerProps) {
  const { t } = useTranslation();
  const ring = (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block animate-spin rounded-full border-line-strong border-t-primary',
        sizes[size],
      )}
    />
  );
  if (inline) return <span className={cx('inline-flex', className)}>{ring}</span>;
  return (
    <div
      role="status"
      className={cx(
        'flex items-center justify-center',
        size !== 'sm' && size !== 'xs' && 'p-6',
        className,
      )}
    >
      {ring}
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </div>
  );
}
