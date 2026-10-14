import { useTranslation } from 'react-i18next';
import { cx, Icon } from '@/ui';

interface BrandMarkProps {
  /** Faqat belgi (ixcham sidebar). */
  compact?: boolean;
  /** Login sahifasi: kattaroq, ustma-ust. */
  large?: boolean;
}

export function BrandMark({ compact = false, large = false }: BrandMarkProps) {
  const { t } = useTranslation();
  return (
    <span className={cx('flex items-center gap-2.5', large && 'flex-col gap-3')}>
      <span
        className={cx(
          'flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-sm',
          large ? 'size-12 rounded-xl' : 'size-8',
        )}
      >
        <Icon name="flask" size={large ? 'lg' : 'sm'} />
      </span>
      {!compact && (
        <span className={cx('flex min-w-0 flex-col', large && 'items-center')}>
          <span
            className={cx('font-semibold tracking-tight text-fg', large ? 'text-2xl' : 'text-base')}
          >
            {t('app.name')}
          </span>
          {large && <span className="text-sm text-fg-muted">{t('app.tagline')}</span>}
        </span>
      )}
    </span>
  );
}
