import { cx } from '../../lib/cx';

const variants = {
  text: 'h-4 rounded-md',
  rect: 'rounded-lg',
  circle: 'rounded-full',
} as const;

export interface SkeletonProps {
  variant?: keyof typeof variants;
  /** Matn varianti uchun qatorlar soni (oxirgisi qisqaroq). */
  lines?: number;
  /** O'lcham klasslari (masalan, `h-24 w-full`). */
  className?: string;
}

/**
 * Yuklanish joy egasi — kontent shaklini oldindan ko'rsatadi (spinner o'rniga). Bezak: `aria-hidden`;
 * yuklanish holatini o'rab turgan konteyner e'lon qiladi (`aria-busy` / role=status).
 */
export function Skeleton({ variant = 'text', lines = 1, className }: SkeletonProps) {
  const block = (key?: number, extra?: string) => (
    <span
      key={key}
      aria-hidden="true"
      className={cx('block animate-pulse-soft bg-skeleton', variants[variant], extra, className)}
    />
  );
  if (variant !== 'text' || lines <= 1) return block();
  const widthOf = (i: number) => (i === lines - 1 ? 'w-2/3' : 'w-full');
  return (
    <span aria-hidden="true" className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => block(i, widthOf(i)))}
    </span>
  );
}
