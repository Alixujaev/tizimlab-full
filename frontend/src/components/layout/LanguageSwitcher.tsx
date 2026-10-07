import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES, type Language } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t('topbar.language')}
      </label>
      <select
        id={id}
        value={i18n.language}
        onChange={(e) => void changeLanguage(e.target.value as Language)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`languages.${lng}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
