import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SensorConfigDto, TemperatureReadingDto } from '@/types';
import { Card, EmptyState } from '@/ui';

interface TemperatureChartProps {
  readings: TemperatureReadingDto[];
  sensor?: SensorConfigDto | null;
}

// SVG koordinatalari (viewBox) — CSS o'lchami emas, grafik ichki tizimi
const WIDTH = 650;
const HEIGHT = 220;
const PAD_X = 45;
const PAD_Y = 25;

/** So'nggi 20 ta o'qish grafigi; ranglar dizayn tokenlaridan (dark mode bilan mos). */
export function TemperatureChart({ readings, sensor }: TemperatureChartProps) {
  const { t } = useTranslation();
  const sorted = useMemo(() => [...readings].reverse().slice(-20), [readings]);
  const title = (
    <span>
      {t('temperature.chartTitle')}
      {sensor && (
        <span className="ml-2 font-normal text-fg-muted">
          {sensor.locationName} ({sensor.sensorId})
        </span>
      )}
    </span>
  );

  if (sorted.length === 0) {
    return (
      <Card title={title}>
        <EmptyState size="sm" icon="thermometer" title={t('temperature.noReadings')} />
      </Card>
    );
  }

  const temps = sorted.map((r) => r.temperature);
  const minLimit = sensor ? sensor.tempMin : Math.min(...temps) - 2;
  const maxLimit = sensor ? sensor.tempMax : Math.max(...temps) + 2;
  const yMin = Math.floor(Math.min(...temps, minLimit) - 2);
  const yMax = Math.ceil(Math.max(...temps, maxLimit) + 2);
  const yRange = yMax - yMin || 1;
  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_Y * 2;
  const getX = (i: number) =>
    sorted.length <= 1 ? PAD_X + plotW / 2 : PAD_X + (i / (sorted.length - 1)) * plotW;
  const getY = (temp: number) => PAD_Y + plotH - ((temp - yMin) / yRange) * plotH;
  const points = sorted.map((r, i) => `${getX(i)},${getY(r.temperature)}`).join(' ');
  const labelEvery = Math.ceil(sorted.length / 5);

  return (
    <Card
      title={title}
      actions={
        <div className="hidden flex-wrap items-center gap-4 text-xs text-fg-muted sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" />
            {t('temperature.temperature')}
          </span>
          {sensor && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-b-2 border-dashed border-success" />
                {t('temperature.min')} {sensor.tempMin}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-b-2 border-dashed border-danger" />
                {t('temperature.max')} {sensor.tempMax}
              </span>
            </>
          )}
        </div>
      }
    >
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t('temperature.chartTitle')}
          className="w-full min-w-lg overflow-visible text-xs"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = PAD_Y + plotH - ratio * plotH;
            return (
              <g key={ratio}>
                <line
                  x1={PAD_X}
                  y1={y}
                  x2={WIDTH - PAD_X}
                  y2={y}
                  stroke="var(--tl-line)"
                  strokeWidth="1"
                />
                <text
                  x={PAD_X - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--tl-fg-subtle)"
                  fontSize="10"
                >
                  {(yMin + ratio * yRange).toFixed(1)}°
                </text>
              </g>
            );
          })}
          {sensor && (
            <>
              <line
                x1={PAD_X}
                y1={getY(sensor.tempMin)}
                x2={WIDTH - PAD_X}
                y2={getY(sensor.tempMin)}
                stroke="var(--tl-success)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <line
                x1={PAD_X}
                y1={getY(sensor.tempMax)}
                x2={WIDTH - PAD_X}
                y2={getY(sensor.tempMax)}
                stroke="var(--tl-danger)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </>
          )}
          <polyline
            fill="none"
            stroke="var(--tl-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
          {sorted.map((r, i) => {
            const cx = getX(i);
            const cy = getY(r.temperature);
            const d = new Date(r.recordedAt);
            const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            return (
              <g key={r.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r.alertTriggered ? 5 : 4}
                  fill={r.alertTriggered ? 'var(--tl-danger)' : 'var(--tl-primary)'}
                  stroke="var(--tl-surface)"
                  strokeWidth="2"
                />
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fill={r.alertTriggered ? 'var(--tl-danger)' : 'var(--tl-fg)'}
                  fontSize="10"
                  fontWeight={r.alertTriggered ? 600 : 500}
                >
                  {r.temperature}°
                </text>
                {(i === 0 || i === sorted.length - 1 || i % labelEvery === 0) && (
                  <text
                    x={cx}
                    y={HEIGHT - 5}
                    textAnchor="middle"
                    fill="var(--tl-fg-subtle)"
                    fontSize="10"
                  >
                    {time}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}
