import { cx } from '../../lib/cx';
import { ICONS, type IconName } from './icons';

const sizes = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
} as const;

export type IconSize = keyof typeof sizes;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
  /** Berilsa — ikon mazmunli (`role="img"`); aks holda bezak (`aria-hidden`). */
  label?: string;
}

export function Icon({ name, size = 'md', className, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('shrink-0', sizes[size], className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
