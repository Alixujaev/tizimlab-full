import { cx } from '../../lib/cx';
import { SERIES_FILL, seriesIndex } from './chartUtils';
import { useNumberFormat } from './useNumberFormat';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Qiymat yonidagi qo'shimcha matn (masalan, "80%"). */
  note?: string;
}

export interface BarChartProps {
  data: ReadonlyArray<BarDatum>;
  ariaLabel: string;
  formatValue?: (v: number) => string;
  colorIndex?: number;
  /** Shkala maksimumi (berilmasa — eng katta qiymat). */
  max?: number;
  onBarClick?: (d: BarDatum) => void;
  className?: string;
}

/**
 * Gorizontal ustunli grafik (toifa nomlari uzun bo'lishi mumkin — mobilda ham o'qiladi):
 * har qator yorlig'i va qiymati to'g'ridan yozilgan, ustun nolga bog'langan.
 */
export function BarChart({
  data,
  ariaLabel,
  formatValue,
  colorIndex = 0,
  max,
  onBarClick,
  className,
}: BarChartProps) {
  const defaultFormat = useNumberFormat();
  const fmt = formatValue ?? defaultFormat;
  const top = Math.max(1, max ?? Math.max(0, ...data.map((d) => d.value)));
  return (
    <ul aria-label={ariaLabel} className={cx('flex flex-col gap-2.5', className)}>
      {data.map((d) => {
        const pct = Math.max(0, Math.min(100, (d.value / top) * 100));
        const text = `${d.label}: ${fmt(d.value)}${d.note ? ` (${d.note})` : ''}`;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-fg">{d.label}</span>
              <span className="shrink-0 tabular-nums text-fg">
                <span className="font-medium">{fmt(d.value)}</span>
                {d.note && <span className="ml-1.5 text-xs text-fg-muted">{d.note}</span>}
              </span>
            </span>
            <svg aria-hidden="true" className="mt-1 block h-2.5 w-full">
              <rect width="100%" height="100%" rx={4} className="fill-chart-grid" />
              {pct > 0 && (
                <rect
                  width={`${pct}%`}
                  height="100%"
                  rx={4}
                  className={SERIES_FILL[seriesIndex(colorIndex)]}
                />
              )}
            </svg>
          </>
        );
        return (
          <li key={d.key} aria-label={text}>
            {onBarClick ? (
              <button
                type="button"
                className="block w-full rounded-md text-left focus-ring hover:bg-surface-muted"
                onClick={() => onBarClick(d)}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
