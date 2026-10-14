import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { cx } from '../../lib/cx';

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Berilsa — "Qayta urinish" tugmasi (masalan, React Query `refetch`). */
  onRetry?: () => void;
  retrying?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  size = 'md',
  className,
}: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'gap-3 px-6 py-12' : 'gap-2 px-4 py-6',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger-fg">
        <Icon name="alert-triangle" size="lg" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium text-fg">{title ?? t('ui.errorTitle')}</p>
        <p className="text-sm text-fg-muted">{description ?? t('ui.errorText')}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon="refresh"
          loading={retrying}
          onClick={onRetry}
        >
          {t('ui.retry')}
        </Button>
      )}
    </div>
  );
}
