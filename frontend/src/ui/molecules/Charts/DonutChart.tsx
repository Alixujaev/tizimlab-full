import { useState } from 'react';
import { cx } from '../../lib/cx';
import { MAX_SERIES, SERIES_BG, SERIES_FILL, SERIES_STROKE, seriesIndex } from './chartUtils';
import { useNumberFormat } from './useNumberFormat';

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
}

export interface DonutChartProps {
  data: ReadonlyArray<DonutDatum>;
  ariaLabel: string;
  /** Markazdagi yozuv (masalan, "Jami"). */
  centerLabel: string;
  /** MAX_SERIES dan ortiq toifalar shu nom bilan bitta bo'lakka yig'iladi. */
  otherLabel: string;
  formatValue?: (v: number) => string;
  className?: string;
}

const SIZE = 160;
const R = 64;
const W = 22;

function arc(a0: number, a1: number): string {
  const p = (a: number, r: number) =>
    `${(SIZE / 2 + r * Math.sin(a)).toFixed(2)} ${(SIZE / 2 - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const ro = R + W / 2;
  const ri = R - W / 2;
  return `M${p(a0, ro)} A${ro} ${ro} 0 ${large} 1 ${p(a1, ro)} L${p(a1, ri)} A${ri} ${ri} 0 ${large} 0 ${p(a0, ri)} Z`;
}

/** Halqa diagramma (ulush): ko'pi bilan 6 bo'lak, qolgani "boshqa"; legenda qiymat + foiz bilan. */
export function DonutChart({
  data,
  ariaLabel,
  centerLabel,
  otherLabel,
  formatValue,
  className,
}: DonutChartProps) {
  const defaultFormat = useNumberFormat();
  const fmt = formatValue ?? defaultFormat;
  const [active, setActive] = useState<string | null>(null);
  const positive = data.filter((d) => d.value > 0);
  const items: DonutDatum[] =
    positive.length > MAX_SERIES
      ? [
          ...positive.slice(0, MAX_SERIES - 1),
          {
            key: '__other',
            label: otherLabel,
            value: positive.slice(MAX_SERIES - 1).reduce((s, d) => s + d.value, 0),
          },
        ]
      : positive;
  const total = items.reduce((s, d) => s + d.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 1000) / 10 : 0);
  const angles = items.reduce<number[]>((acc, d) => {
    acc.push((acc.at(-1) ?? 0) + (d.value / total) * Math.PI * 2);
    return acc;
  }, []);

  return (
    <div className={cx('flex flex-col items-center gap-4 sm:flex-row sm:items-start', className)}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-40 shrink-0"
      >
        {items.length === 1 ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={W}
            className={SERIES_STROKE[0]}
          />
        ) : (
          items.map((d, i) => (
            <path
              key={d.key}
              d={arc(i === 0 ? 0 : angles[i - 1]!, angles[i]!)}
              strokeWidth={2}
              className={cx(
                SERIES_FILL[seriesIndex(i)],
                'stroke-surface motion-safe:transition-opacity',
                active && active !== d.key && 'opacity-40',
              )}
            />
          ))
        )}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-fg text-2xl font-semibold tabular-nums"
        >
          {fmt(total)}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-fg-muted text-xs">
          {centerLabel}
        </text>
      </svg>
      <ul className="flex w-full min-w-0 flex-col gap-1.5 text-sm">
        {items.map((d, i) => (
          <li
            key={d.key}
            tabIndex={0}
            aria-label={`${d.label}: ${fmt(d.value)} (${fmt(pct(d.value))}%)`}
            className="flex items-center gap-2 rounded-md px-1 focus-ring hover:bg-surface-muted"
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(d.key)}
            onBlur={() => setActive(null)}
          >
            <span
              aria-hidden="true"
              className={cx('size-2.5 shrink-0 rounded-sm', SERIES_BG[seriesIndex(i)])}
            />
            <span className="min-w-0 flex-1 truncate text-fg">{d.label}</span>
            <span className="font-medium tabular-nums text-fg">{fmt(d.value)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-fg-muted">
              {fmt(pct(d.value))}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
