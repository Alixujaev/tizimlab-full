import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon';
import { Spinner } from '../Spinner';

/** Tugma variantlari — Button, IconButton va havola-tugmalar uchun yagona manba. */
export const buttonVariants = {
  primary: 'bg-primary text-primary-fg shadow-sm enabled:hover:bg-primary-hover',
  secondary:
    'border border-line-strong bg-surface text-fg shadow-sm enabled:hover:bg-surface-sunken',
  ghost: 'text-fg-muted enabled:hover:bg-surface-sunken enabled:hover:text-fg',
  danger: 'bg-danger text-primary-fg shadow-sm enabled:hover:bg-danger-hover',
  'danger-ghost': 'text-danger-fg enabled:hover:bg-danger-subtle',
} as const;

export const buttonSizes = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-9 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-base',
} as const;

export const buttonBase =
  'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors motion-fast focus-ring disabled:cursor-not-allowed disabled:opacity-50';

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Amal bajarilmoqda: tugma o'chadi, `aria-busy`, chap ikon o'rnida spinner. */
  loading?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  fullWidth?: boolean;
}

export function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'lg' ? 'md' : 'sm';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner inline size={iconSize} />
      ) : (
        leftIcon && <Icon name={leftIcon} size={iconSize} />
      )}
      {children}
      {rightIcon && !loading && <Icon name={rightIcon} size={iconSize} />}
    </button>
  );
}
