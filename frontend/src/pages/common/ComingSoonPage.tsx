import { useTranslation } from 'react-i18next';

/** Vaqtinchalik sahifa: tegishli fazada haqiqiy sahifa bilan almashtiriladi. */
export function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
      <p className="mt-2 text-slate-600">{t('common.comingSoon')}</p>
    </section>
  );
}
