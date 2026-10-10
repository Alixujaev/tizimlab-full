import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SensorConfigDto, TemperatureReadingDto } from '@/types';

interface TemperatureChartProps {
  readings: TemperatureReadingDto[];
  sensor?: SensorConfigDto | null;
}

export function TemperatureChart({ readings, sensor }: TemperatureChartProps) {
  const { t } = useTranslation();

  // So'nggi o'qishlarni xronologik tartibda (eskilardan yangilariga) saralaymiz
  const sorted = useMemo(() => {
    return [...readings].reverse().slice(-20); // So'nggi 20 ta o'qish
  }, [readings]);

  if (sorted.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        {t('temperature.noReadings')}
      </div>
    );
  }

  const temps = sorted.map((r) => r.temperature);
  const minTempLimit = sensor ? sensor.tempMin : Math.min(...temps) - 2;
  const maxTempLimit = sensor ? sensor.tempMax : Math.max(...temps) + 2;

  const yMin = Math.floor(Math.min(...temps, minTempLimit) - 2);
  const yMax = Math.ceil(Math.max(...temps, maxTempLimit) + 2);
  const yRange = yMax - yMin || 1;

  const width = 650;
  const height = 220;
  const paddingX = 45;
  const paddingY = 25;

  const plotW = width - paddingX * 2;
  const plotH = height - paddingY * 2;

  const getX = (idx: number) => {
    if (sorted.length <= 1) return paddingX + plotW / 2;
    return paddingX + (idx / (sorted.length - 1)) * plotW;
  };

  const getY = (temp: number) => {
    return paddingY + plotH - ((temp - yMin) / yRange) * plotH;
  };

  const points = sorted.map((r, i) => `${getX(i)},${getY(r.temperature)}`).join(' ');

  const minLimitY = sensor ? getY(sensor.tempMin) : null;
  const maxLimitY = sensor ? getY(sensor.tempMax) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-800">
          <span>{t('temperature.chartTitle')}</span>
          {sensor && <span className="ml-2">&mdash; {sensor.locationName} ({sensor.sensorId})</span>}
        </h3>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>{t('temperature.temperature')}</span>
          </span>
          {sensor && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 border-b-2 border-dashed border-emerald-500" />
                <span>{t('temperature.min')} {sensor.tempMin}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 border-b-2 border-dashed border-rose-500" />
                <span>{t('temperature.max')} {sensor.tempMax}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[500px] overflow-visible text-xs"
        >
          {/* Orqa fon gorizontal grid chiziqlari */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const tempVal = (yMin + ratio * yRange).toFixed(1);
            const y = paddingY + plotH - ratio * plotH;
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text x={paddingX - 8} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="10">
                  {tempVal}&deg;
                </text>
              </g>
            );
          })}

          {/* Min chegara chizig'i (yashil) */}
          {minLimitY != null && (
            <g>
              <line
                x1={paddingX}
                y1={minLimitY}
                x2={width - paddingX}
                y2={minLimitY}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </g>
          )}

          {/* Maks chegara chizig'i (qizil) */}
          {maxLimitY != null && (
            <g>
              <line
                x1={paddingX}
                y1={maxLimitY}
                x2={width - paddingX}
                y2={maxLimitY}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </g>
          )}

          {/* Harorat grafigi chizig'i */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Nuqtalar va qiymatlar */}
          {sorted.map((r, i) => {
            const cx = getX(i);
            const cy = getY(r.temperature);
            const isAlert = r.alertTriggered;
            const d = new Date(r.recordedAt);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

            return (
              <g key={r.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isAlert ? 5 : 4}
                  fill={isAlert ? '#ef4444' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all hover:r-6"
                />
                {/* Nuqta ustidagi qiymat */}
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fill={isAlert ? '#ef4444' : '#1e293b'}
                  fontSize="10"
                  fontWeight={isAlert ? '600' : '500'}
                >
                  {r.temperature}&deg;
                </text>
                {/* Pastdagi vaqt */}
                {(i === 0 || i === sorted.length - 1 || i % Math.ceil(sorted.length / 5) === 0) && (
                  <text x={cx} y={height - 5} textAnchor="middle" fill="#94a3b8" fontSize="10">
                    {timeStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
