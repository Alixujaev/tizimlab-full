import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  /** Kod/raqam (lot, seriya) — monospace. */
  mono?: boolean;
  /** Ikki ustunni egallaydi (uzun matn). */
  wide?: boolean;
}

export interface DescriptionListProps {
  items: ReadonlyArray<DescriptionItem | false | null | undefined>;
  columns?: 1 | 2 | 3;
  className?: string;
}

const cols = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' } as const;

/** Tafsilot maydonlari (yorliq → qiymat). Bo'sh qiymat "—" bilan ko'rsatiladi. */
export function DescriptionList({ items, columns = 2, className }: DescriptionListProps) {
  return (
    <dl className={cx('grid grid-cols-1 gap-x-6 gap-y-4 text-sm', cols[columns], className)}>
      {items.filter(Boolean).map((item, i) => {
        const it = item as DescriptionItem;
        const empty = it.value === null || it.value === undefined || it.value === '';
        return (
          <div key={i} className={cx('min-w-0', it.wide && 'sm:col-span-full')}>
            <dt className="text-xs font-medium text-fg-muted">{it.label}</dt>
            <dd className={cx('mt-1 break-words text-fg', it.mono && 'font-mono text-sm')}>
              {empty ? <span className="text-fg-subtle">—</span> : it.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
