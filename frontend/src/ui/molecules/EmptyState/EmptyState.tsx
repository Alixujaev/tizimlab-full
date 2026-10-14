import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../atoms/Icon';
import { cx } from '../../lib/cx';

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  /** Keyingi qadam (masalan, "Namuna qo'shish" tugmasi). */
  action?: ReactNode;
  size?: 'sm' | 'md';
  /** Sarlavha elementi: sahifa darajasidagi holat (403/404) uchun `h1`. */
  titleAs?: 'p' | 'h1' | 'h2';
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon = 'layers',
  action,
  size = 'md',
  titleAs: Title = 'p',
  className,
}: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'gap-3 px-6 py-12' : 'gap-2 px-4 py-6',
        className,
      )}
    >
      <span
        className={cx(
          'flex items-center justify-center rounded-full bg-surface-sunken text-fg-subtle',
          size === 'md' ? 'size-12' : 'size-9',
        )}
      >
        <Icon name={icon} size={size === 'md' ? 'lg' : 'md'} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <Title
          className={cx(
            'font-medium text-fg',
            Title === 'h1' ? 'text-2xl font-semibold' : size === 'md' ? 'text-base' : 'text-sm',
          )}
        >
          {title ?? t('ui.emptyTitle')}
        </Title>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
