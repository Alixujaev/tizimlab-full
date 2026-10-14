import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { toneClasses, toneDot, type Tone } from '../Badge';

export interface StatusPillProps {
  tone: Tone;
  children: ReactNode;
  /** Jarayon davom etmoqda (masalan, "Tahlilda") — nuqta yumshoq miltillaydi. */
  pulse?: boolean;
  className?: string;
}

/** Ish oqimi holati (namuna, protokol, tadqiqot ...): rangli nuqta + matn. Rang yolg'iz ma'no tashimaydi. */
export function StatusPill({ tone, children, pulse = false, className }: StatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-1.5 rounded-full', toneDot[tone], pulse && 'animate-pulse-soft')}
      />
      {children}
    </span>
  );
}
