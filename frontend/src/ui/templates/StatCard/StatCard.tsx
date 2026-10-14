import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../../atoms/Icon';
import { cx } from '../../lib/cx';

const iconTones = {
  primary: 'bg-primary-subtle text-primary-subtle-fg',
  success: 'bg-success-subtle text-success-fg',
  warning: 'bg-warning-subtle text-warning-fg',
  danger: 'bg-danger-subtle text-danger-fg',
  info: 'bg-info-subtle text-info-fg',
  accent: 'bg-accent-subtle text-accent-fg',
} as const;

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Berilsa — karta havola (tegishli ro'yxatga o'tadi). */
  to?: string;
  icon?: IconName;
  tone?: keyof typeof iconTones;
  /** Diqqat talab qiladi (masalan, tasdiq kutayotganlar > 0). */
  highlight?: boolean;
  hint?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  to,
  icon,
  tone = 'primary',
  highlight = false,
  hint,
  className,
}: StatCardProps) {
  // Yorliq va qiymat bitta ota-elementda (o'qilishi: "yorliq qiymat"); ikon burchakda bezak sifatida
  const body = (
    <>
      {icon && (
        <span
          aria-hidden="true"
          className={cx(
            'absolute right-4 top-4 flex size-9 items-center justify-center rounded-lg',
            iconTones[tone],
          )}
        >
          <Icon name={icon} size="sm" />
        </span>
      )}
      <span className={cx('block text-sm font-medium text-fg-muted', icon && 'pr-12')}>
        {label}
      </span>
      <span
        className={cx(
          'mt-2 block text-3xl font-semibold tabular-nums tracking-tight',
          highlight ? 'text-warning-fg' : 'text-fg',
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
    </>
  );
  const base = cx(
    'relative block rounded-xl border bg-surface p-5 shadow-sm',
    highlight ? 'border-warning-line' : 'border-line',
    className,
  );
  return to ? (
    <Link
      to={to}
      className={cx(
        base,
        'transition-[border-color,box-shadow,transform] motion-base focus-ring hover:-translate-y-0.5 hover:border-primary-line hover:shadow-md',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
