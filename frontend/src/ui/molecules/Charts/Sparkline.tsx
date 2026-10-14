import { cx } from '../../lib/cx';
import { SERIES_STROKE, seriesIndex } from './chartUtils';

export interface SparklineProps {
  values: ReadonlyArray<number>;
  /** Masalan: "So'nggi 30 kun: 0 dan 7 gacha". */
  ariaLabel: string;
  colorIndex?: number;
  className?: string;
}

/** Ixcham trend chizig'i (o'qsiz) — KPI kartalarida. Tafsiloti asosiy grafik/jadvalda. */
export function Sparkline({ values, ariaLabel, colorIndex = 0, className }: SparklineProps) {
  const n = values.length;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = n <= 1 ? 50 : (i / (n - 1)) * 100;
    return `${x.toFixed(2)},${(30 - (v / max) * 28).toFixed(2)}`;
  });
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={cx('block h-8 w-full', className)}
    >
      {n > 0 && (
        <polyline
          points={pts.join(' ')}
          fill="none"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          className={SERIES_STROKE[seriesIndex(colorIndex)]}
        />
      )}
    </svg>
  );
}
