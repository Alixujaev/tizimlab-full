import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';

const variants = {
  /** Ro'yxat qatori (bildirishnoma, tanlov ro'yxati). */
  row: 'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted',
  /** Bosiladigan karta. */
  card: 'flex w-full flex-col gap-1 rounded-xl border border-line bg-surface p-4 text-left shadow-sm hover:border-line-strong hover:shadow-md',
} as const;

export interface PressableProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  variant?: keyof typeof variants;
  /** Tanlangan/faol holat (masalan, o'qilmagan bildirishnoma) — yumshoq fon. */
  highlighted?: boolean;
}

/**
 * Boy mazmunli bosiladigan sirt (bir nechta qatorli matn, ikon, belgi) — `Button` sig'magan joylar uchun.
 * Semantikasi — haqiqiy tugma (klaviatura, fokus), ko'rinishi — tokenlardan.
 */
export function Pressable({
  variant = 'row',
  highlighted = false,
  className,
  ...rest
}: PressableProps) {
  return (
    <button
      type="button"
      className={cx(
        'transition-colors motion-fast disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'row' ? 'focus-ring-inset' : 'focus-ring',
        variants[variant],
        highlighted && 'bg-primary-subtle/60',
        className,
      )}
      {...rest}
    />
  );
}
