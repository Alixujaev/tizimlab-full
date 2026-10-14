import { cx } from '../../lib/cx';

const sizes = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
} as const;

// Ism bo'yicha barqaror rang (har safar bir xil)
const palette = [
  'bg-primary-subtle text-primary-subtle-fg',
  'bg-success-subtle text-success-fg',
  'bg-warning-subtle text-warning-fg',
  'bg-info-subtle text-info-fg',
  'bg-accent-subtle text-accent-fg',
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const base = cx(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
    sizes[size],
    className,
  );
  if (src) return <img src={src} alt={name} className={cx(base, 'object-cover')} />;
  return (
    <span role="img" aria-label={name} className={cx(base, palette[hash(name) % palette.length])}>
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}
