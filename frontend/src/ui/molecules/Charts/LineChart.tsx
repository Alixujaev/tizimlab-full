import { type KeyboardEvent, type PointerEvent, useId, useState } from 'react';
import { cx } from '../../lib/cx';
import { ChartLegend } from './ChartLegend';
import {
  niceScale,
  SERIES_BG,
  SERIES_FILL,
  SERIES_STROKE,
  seriesIndex,
  thinIndexes,
  useChartWidth,
} from './chartUtils';
import { useNumberFormat } from './useNumberFormat';

export interface LineSeries {
  key: string;
  label: string;
  values: ReadonlyArray<number | null>;
}

export interface LineChartProps {
  /** X o'qi toifalari (sana va h.k.), har seriyaning `values` uzunligi bilan teng. */
  labels: ReadonlyArray<string>;
  series: ReadonlyArray<LineSeries>;
  /** Grafikning qisqa tavsifi (ekran o'quvchilar uchun). */
  ariaLabel: string;
  formatLabel?: (label: string) => string;
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
}

const M = { top: 12, right: 12, bottom: 26, left: 40 };

/**
 * Chiziqli grafik (bitta Y o'qi): 2px chiziqlar, nozik grid, kursor/klaviatura (← →) bilan
 * crosshair + tooltip; ≥ 2 seriyada legenda.
 */
export function LineChart({
  labels,
  series,
  ariaLabel,
  formatLabel = (l) => l,
  formatValue,
  height = 220,
  className,
}: LineChartProps) {
  const defaultFormat = useNumberFormat();
  const fmt = formatValue ?? defaultFormat;
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tipId = useId();

  const n = labels.length;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { max, step } = niceScale(Math.max(0, ...all));
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const shownX = thinIndexes(n, Math.max(2, Math.floor(innerW / 70)));

  const path = (values: ReadonlyArray<number | null>) =>
    values
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .reduce<string>((d, pt, i, arr) => {
        if (pt === null) return d;
        return d + (i === 0 || arr[i - 1] === null ? ` M${pt}` : ` L${pt}`);
      }, '')
      .trim();

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = n <= 1 ? 0 : Math.round(((px - M.left) / innerW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    const keys: Record<string, number> = {
      ArrowRight: Math.min(n - 1, (active ?? -1) + 1),
      ArrowLeft: Math.max(0, (active ?? n) - 1),
      Home: 0,
      End: n - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      setActive(keys[e.key]!);
    } else if (e.key === 'Escape') setActive(null);
  };

  const tipLeft = active === null ? 0 : (x(active) / width) * 100;

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      {series.length > 1 && (
        <ChartLegend items={series.map((s) => ({ key: s.key, label: s.label }))} />
      )}
      <div
        ref={ref}
        className="relative rounded-md focus-ring"
        tabIndex={0}
        role="group"
        aria-label={ariaLabel}
        aria-describedby={active !== null ? tipId : undefined}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg
          role="img"
          aria-label={ariaLabel}
          width={width}
          height={height}
          className="block max-w-full touch-pan-y"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-chart-grid"
                strokeWidth={1}
              />
              <text
                x={M.left - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-chart-axis text-xs tabular-nums"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            shownX.has(i) ? (
              <text
                key={l}
                x={x(i)}
                y={height - 6}
                textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
                className="fill-chart-axis text-xs"
              >
                {formatLabel(l)}
              </text>
            ) : null,
          )}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={M.top}
              y2={M.top + innerH}
              className="stroke-chart-axis"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
          {series.map((s, si) => (
            <g key={s.key}>
              <path
                d={path(s.values)}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={SERIES_STROKE[seriesIndex(si)]}
              />
              {/* Yakka nuqtalar (chiziq hosil qilmaydigan) ko'rinsin */}
              {s.values.map((v, i) =>
                v !== null &&
                (s.values[i - 1] ?? null) === null &&
                (s.values[i + 1] ?? null) === null ? (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={4}
                    strokeWidth={2}
                    className={cx(SERIES_FILL[seriesIndex(si)], 'stroke-surface')}
                  />
                ) : null,
              )}
              {active !== null && s.values[active] != null && (
                <circle
                  cx={x(active)}
                  cy={y(s.values[active]!)}
                  r={4.5}
                  strokeWidth={2}
                  className={cx(SERIES_FILL[seriesIndex(si)], 'stroke-surface')}
                />
              )}
            </g>
          ))}
        </svg>
        {active !== null && (
          <div
            id={tipId}
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-md"
            style={{ left: `${Math.min(85, Math.max(15, tipLeft))}%` }}
          >
            <p className="font-medium text-fg">{formatLabel(labels[active]!)}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {series.map((s, si) => (
                <li key={s.key} className="flex items-center gap-1.5 text-fg-muted">
                  <span
                    aria-hidden="true"
                    className={cx('size-2 rounded-sm', SERIES_BG[seriesIndex(si)])}
                  />
                  <span>{s.label}</span>
                  <span className="ml-auto pl-3 font-medium tabular-nums text-fg">
                    {s.values[active] === null ? '—' : fmt(s.values[active]!)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
