import { useTranslation } from 'react-i18next';
import { ButtonLink, EmptyState } from '@/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      titleAs="h1"
      icon="search"
      title={t('errors.notFoundTitle')}
      description={t('errors.notFoundText')}
      action={
        <ButtonLink to="/" leftIcon="home">
          {t('errors.backHome')}
        </ButtonLink>
      }
      className="py-20"
    />
  );
}
