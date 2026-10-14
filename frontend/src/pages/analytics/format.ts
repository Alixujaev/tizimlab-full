import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HOUR_METRICS, PERCENT_METRICS } from '@/config/analytics';
import type { MetricUnit } from '@/types';

/** Lokalga mos son/sana formatlovchilari; `null` — "ma'lumot yo'q". */
export function useAnalyticsFormat() {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
    const df = new Intl.DateTimeFormat(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const dfShort = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    const dtf = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
    const number = (v: number) => nf.format(v);
    const value = (v: number | null, unit: MetricUnit): string => {
      if (v === null) return t('analytics.noData');
      if (unit === 'percent') return t('analytics.percent', { value: nf.format(v) });
      if (unit === 'hours') return t('analytics.hours', { value: nf.format(v) });
      return nf.format(v);
    };
    const metric = (key: string, v: number | null) =>
      value(v, PERCENT_METRICS.has(key) ? 'percent' : HOUR_METRICS.has(key) ? 'hours' : 'count');
    const isoDate = (iso: string | null) =>
      iso ? df.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '—';
    const shortDate = (iso: string) => dfShort.format(new Date(`${iso}T00:00:00Z`));
    const dateTime = (iso: string | null) => (iso ? dtf.format(new Date(iso)) : '—');
    return { number, value, metric, isoDate, shortDate, dateTime };
  }, [t, i18n.language]);
}
