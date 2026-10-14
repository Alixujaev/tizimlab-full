import { useTranslation } from 'react-i18next';
import { ButtonLink, EmptyState } from '@/ui';

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      titleAs="h1"
      icon="shield"
      title={t('errors.forbiddenTitle')}
      description={t('errors.forbiddenText')}
      action={
        <ButtonLink to="/" leftIcon="home">
          {t('errors.backHome')}
        </ButtonLink>
      }
      className="py-20"
    />
  );
}
