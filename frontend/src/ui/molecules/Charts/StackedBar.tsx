import { cx } from '../../lib/cx';
import { ChartLegend } from './ChartLegend';
import { SERIES_FILL, seriesIndex } from './chartUtils';
import { useNumberFormat } from './useNumberFormat';

export interface StackedBarProps {
  data: ReadonlyArray<{ key: string; label: string; value: number }>;
  ariaLabel: string;
  formatValue?: (v: number) => string;
  className?: string;
}

/** 100% to'plangan ustun (taqsimot): segmentlar orasida 2px sirt bo'shlig'i, legenda qiymat va foiz bilan. */
export function StackedBar({ data, ariaLabel, formatValue, className }: StackedBarProps) {
  const defaultFormat = useNumberFormat();
  const fmt = formatValue ?? defaultFormat;
  const total = data.reduce((s, d) => s + d.value, 0);
  const pct = (v: number) => (total ? (v / total) * 100 : 0);
  const starts = data.reduce<number[]>((acc, d, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + pct(data[i - 1]!.value));
    return acc;
  }, []);
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <svg role="img" aria-label={ariaLabel} className="block h-4 w-full">
        <rect width="100%" height="100%" rx={4} className="fill-chart-grid" />
        {data.map((d, i) =>
          d.value > 0 ? (
            <rect
              key={d.key}
              x={`${starts[i]}%`}
              width={`${pct(d.value)}%`}
              height="100%"
              rx={3}
              strokeWidth={2}
              className={cx(SERIES_FILL[seriesIndex(i)], 'stroke-surface')}
            >
              <title>{`${d.label}: ${fmt(d.value)}`}</title>
            </rect>
          ) : null,
        )}
      </svg>
      <ChartLegend
        items={data.map((d) => ({
          key: d.key,
          label: d.label,
          value: total
            ? `${fmt(d.value)} · ${fmt(Math.round(pct(d.value) * 10) / 10)}%`
            : fmt(d.value),
        }))}
      />
    </div>
  );
}
