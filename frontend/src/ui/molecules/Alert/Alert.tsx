import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../atoms/Icon';
import { cx } from '../../lib/cx';

const tones = {
  info: { box: 'border-info-line bg-info-subtle text-info-fg', icon: 'info' },
  success: { box: 'border-success-line bg-success-subtle text-success-fg', icon: 'check-circle' },
  warning: { box: 'border-warning-line bg-warning-subtle text-warning-fg', icon: 'alert-triangle' },
  danger: { box: 'border-danger-line bg-danger-subtle text-danger-fg', icon: 'alert-circle' },
} as const satisfies Record<string, { box: string; icon: IconName }>;

export interface AlertProps {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  /** Amal (masalan, "Qayta urinish") — o'ng tomonda. */
  action?: ReactNode;
  className?: string;
}

/**
 * Sahifa/forma ichidagi xabar bloki. `danger`/`warning` — `role="alert"` (darhol o'qiladi),
 * `info`/`success` — `role="status"`.
 */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', t.box, className)}
    >
      <Icon name={t.icon} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
