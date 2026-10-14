import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface DetailLayoutProps {
  /** Asosiy mazmun (Card'lar, Tabs). */
  children: ReactNode;
  /** Yon panel: xulosa, holat, amallar. Mobil'da asosiy mazmundan oldin chiqadi. */
  aside?: ReactNode;
  className?: string;
}

/** Tafsilot sahifasi: desktop'da 2/3 + 1/3, mobil'da bitta ustun (yon panel tepada). */
export function DetailLayout({ children, aside, className }: DetailLayoutProps) {
  if (!aside) return <div className={cx('flex flex-col gap-6', className)}>{children}</div>;
  return (
    <div className={cx('grid gap-6 lg:grid-cols-3', className)}>
      <div className="flex min-w-0 flex-col gap-6 lg:order-1 lg:col-span-2">{children}</div>
      <aside className="order-first flex min-w-0 flex-col gap-6 lg:order-2">{aside}</aside>
    </div>
  );
}
