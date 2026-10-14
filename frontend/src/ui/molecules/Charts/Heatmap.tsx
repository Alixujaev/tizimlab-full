import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { SEQ_BG, SEQ_FILL } from './chartUtils';
import { useNumberFormat } from './useNumberFormat';

export interface HeatmapProps {
  /** Kunlik qiymatlar (ISO sana YYYY-MM-DD), ketma-ket kunlar. */
  days: ReadonlyArray<{ date: string; value: number }>;
  ariaLabel: string;
  formatDate?: (iso: string) => string;
  className?: string;
}

const CELL = 14;
const GAP = 3;
const LEFT = 26;

/** 0 = dushanba. */
const weekdayIndex = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Kalendar issiqlik xaritasi: ustun — hafta, qator — hafta kuni; bitta rang, och → to'q (5 pog'ona). */
export function Heatmap({ days, ariaLabel, formatDate = (d) => d, className }: HeatmapProps) {
  const { i18n } = useTranslation();
  const fmt = useNumberFormat();
  const max = Math.max(0, ...days.map((d) => d.value));
  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const first = days[0] ? weekdayIndex(days[0].date) : 0;
  const weeks = Math.ceil((first + days.length) / 7);
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow', timeZone: 'UTC' });
  const width = LEFT + weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);
  return (
    <div className={cx('flex flex-col gap-2 overflow-x-auto', className)}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        className="block shrink-0"
      >
        {[0, 2, 4].map((d) => (
          <text key={d} x={0} y={d * (CELL + GAP) + CELL - 3} className="fill-chart-axis text-xs">
            {/* 2024-01-01 dushanba bo'lgani uchun tayanch sana */}
            {weekday.format(new Date(Date.UTC(2024, 0, 1 + d)))}
          </text>
        ))}
        {days.map((d, i) => {
          const idx = first + i;
          return (
            <rect
              key={d.date}
              x={LEFT + Math.floor(idx / 7) * (CELL + GAP)}
              y={(idx % 7) * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              className={SEQ_FILL[level(d.value)]}
            >
              <title>{`${formatDate(d.date)}: ${fmt(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div aria-hidden="true" className="flex items-center gap-1 text-xs text-fg-muted">
        <span>0</span>
        {SEQ_BG.map((c) => (
          <span key={c} className={cx('size-3 rounded-sm', c)} />
        ))}
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
