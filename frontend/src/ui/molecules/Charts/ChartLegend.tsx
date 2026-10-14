import { cx } from '../../lib/cx';
import { SERIES_BG, seriesIndex } from './chartUtils';

export interface LegendItem {
  key: string;
  label: string;
  value?: string;
}

/** Legenda: rang yonida doim matn (identifikatsiya faqat rangga tayanmaydi). */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cx('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted', className)}>
      {items.map((item, i) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cx('size-2.5 rounded-sm', SERIES_BG[seriesIndex(i)])}
          />
          <span>{item.label}</span>
          {item.value !== undefined && (
            <span className="font-medium tabular-nums text-fg">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
