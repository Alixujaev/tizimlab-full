import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES } from '@/i18n';
import { Button, Menu } from '@/ui';

/** Til tanlovi (D-27): joriy til belgilangan menyu, tanlov saqlanadi. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <Menu
      items={LANGUAGES.map((lng) => ({
        id: lng,
        label: t(`languages.${lng}`),
        checked: i18n.language === lng,
        onSelect: () => void changeLanguage(lng),
      }))}
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          size="sm"
          leftIcon="globe"
          aria-label={t('topbar.language')}
        >
          <span aria-hidden="true" className="uppercase">
            {i18n.language}
          </span>
        </Button>
      )}
    />
  );
}
