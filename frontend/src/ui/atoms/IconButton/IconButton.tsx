import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';
import { buttonBase, buttonVariants, type ButtonVariant } from '../Button';
import { Icon, type IconName } from '../Icon';
import { Spinner } from '../Spinner';

const sizes = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-11',
} as const;

export interface IconButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'type' | 'children' | 'aria-label'
> {
  icon: IconName;
  /** Majburiy: ekran o'quvchilar uchun nom (ikonli tugmada ko'rinadigan matn yo'q). */
  label: string;
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  type?: 'button' | 'submit';
  loading?: boolean;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonBase, buttonVariants[variant], sizes[size], 'shrink-0 p-0', className)}
      {...rest}
    >
      {loading ? (
        <Spinner inline size="sm" />
      ) : (
        <Icon name={icon} size={size === 'lg' ? 'md' : 'sm'} />
      )}
    </button>
  );
}
