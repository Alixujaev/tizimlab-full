import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon';

export interface TrendDeltaProps {
  value: number | null;
  previous: number | null;
  /** Qaysi yo'nalish yaxshi: rad etish foizi uchun `down`, bajarilganlar uchun `up`. */
  better?: 'up' | 'down' | 'none';
  className?: string;
}

/** Oldingi davrga nisbatan o'zgarish: ▲/▼ ikon + foiz (rang yolg'iz ma'no tashimaydi). */
export function TrendDelta({ value, previous, better = 'up', className }: TrendDeltaProps) {
  const { t, i18n } = useTranslation();
  if (value === null || previous === null || previous === 0) {
    return (
      <span className={cx('text-xs text-fg-subtle', className)}>{t('ui.trend.noCompare')}</span>
    );
  }
  const change = ((value - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change * 10) / 10;
  const dir = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  const good = better === 'none' || dir === 'flat' ? null : dir === better;
  const pct = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
    Math.abs(rounded),
  );
  const label = t(`ui.trend.${dir}`, { value: pct });
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        good === null ? 'text-fg-muted' : good ? 'text-success-fg' : 'text-danger-fg',
        className,
      )}
    >
      {dir !== 'flat' && <Icon name={dir === 'up' ? 'arrow-up' : 'arrow-down'} size="xs" />}
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{dir === 'flat' ? '0%' : `${pct}%`}</span>
    </span>
  );
}
