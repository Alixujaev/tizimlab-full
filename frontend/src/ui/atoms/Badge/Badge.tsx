import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon';

/** Semantik ohanglar — Badge, StatusPill va boshqa holat ko'rsatkichlari uchun yagona manba. */
export const toneClasses = {
  neutral: 'border-line bg-surface-sunken text-fg-muted',
  primary: 'border-primary-line bg-primary-subtle text-primary-subtle-fg',
  success: 'border-success-line bg-success-subtle text-success-fg',
  warning: 'border-warning-line bg-warning-subtle text-warning-fg',
  danger: 'border-danger-line bg-danger-subtle text-danger-fg',
  info: 'border-info-line bg-info-subtle text-info-fg',
  accent: 'border-accent-line bg-accent-subtle text-accent-fg',
} as const;

export const toneDot = {
  neutral: 'bg-fg-subtle',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
} as const;

export type Tone = keyof typeof toneClasses;

const sizes = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
} as const;

export interface BadgeProps {
  tone?: Tone;
  size?: keyof typeof sizes;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

/** Toifa/belgi (tur, rol, son). Jarayon holati uchun — StatusPill. */
export function Badge({ tone = 'neutral', size = 'md', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border font-medium',
        toneClasses[tone],
        sizes[size],
        className,
      )}
    >
      {icon && <Icon name={icon} size="xs" />}
      {children}
    </span>
  );
}
