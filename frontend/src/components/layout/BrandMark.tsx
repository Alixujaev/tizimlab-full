import { useTranslation } from 'react-i18next';
import { cx, Logo, LogoIcon } from '@/ui';

interface BrandMarkProps {
  /** Faqat belgi (ixcham sidebar). */
  compact?: boolean;
  /** Login sahifasi: kattaroq, ustma-ust. */
  large?: boolean;
}

export function BrandMark({ compact = false, large = false }: BrandMarkProps) {
  const { t } = useTranslation();
  if (compact) {
    return (
      <span className="flex items-center">
        <LogoIcon className="size-9" />
        <span className="sr-only">{t('app.name')}</span>
      </span>
    );
  }
  return (
    <span className={cx('flex items-center', large && 'flex-col gap-3')}>
      <Logo
        primary={t('app.namePrimary')}
        secondary={t('app.nameSecondary')}
        size={large ? 'lg' : 'md'}
      />
      {large && <span className="text-sm text-fg-muted">{t('app.tagline')}</span>}
    </span>
  );
}
