import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnalyticsPeriod, AnalyticsPeriodDto, AnalyticsPeriodPreset } from '@/types';
import { Button, DatePicker } from '@/ui';
import { useAnalyticsFormat } from './format';

const PRESETS: readonly AnalyticsPeriodPreset[] = ['7d', '30d', '90d', 'custom'];
const MAX_DAYS = 366;

/** Toshkent bo'yicha bugungi sana (backend bilan bir xil, D-161). */
function todayIso(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
}

function validRange(from: string, to: string): boolean {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return days >= 1 && days <= MAX_DAYS && to <= todayIso();
}

interface PeriodPickerProps {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
  /** Javobdagi aniq oraliq (va taqqoslanayotgan oldingi davr) — yorliq sifatida. */
  resolved?: AnalyticsPeriodDto;
}

/** Davr tanlagich: 7/30/90 kun yoki maxsus oraliq (D-161). */
export function PeriodPicker({ value, onChange, resolved }: PeriodPickerProps) {
  const { t } = useTranslation();
  const fmt = useAnalyticsFormat();
  const [custom, setCustom] = useState(value.period === 'custom');
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  const valid = !!from && !!to && validRange(from, to);

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={t('analytics.period.label')} className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = p === 'custom' ? custom : !custom && value.period === p;
          return (
            <Button
              key={p}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              aria-pressed={active}
              onClick={() => {
                if (p === 'custom') {
                  setCustom(true);
                  return;
                }
                setCustom(false);
                onChange({ period: p });
              }}
            >
              {t(`analytics.period.${p}`)}
            </Button>
          );
        })}
      </div>
      {custom && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            {t('analytics.period.from')}
            <DatePicker value={from} onChange={setFrom} max={to || todayIso()} size="sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            {t('analytics.period.to')}
            <DatePicker
              value={to}
              onChange={setTo}
              min={from || undefined}
              max={todayIso()}
              size="sm"
            />
          </label>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => onChange({ period: 'custom', from, to })}
          >
            {t('analytics.period.apply')}
          </Button>
          {!valid && (from || to) && (
            <p className="w-full text-xs text-danger-fg">{t('analytics.period.invalid')}</p>
          )}
        </div>
      )}
      {resolved && (
        <p className="text-xs text-fg-muted">
          {t('analytics.period.range', {
            from: fmt.isoDate(resolved.from),
            to: fmt.isoDate(resolved.to),
          })}{' '}
          ·{' '}
          {t('analytics.period.compare', {
            from: fmt.isoDate(resolved.previousFrom),
            to: fmt.isoDate(resolved.previousTo),
          })}
        </p>
      )}
    </div>
  );
}
