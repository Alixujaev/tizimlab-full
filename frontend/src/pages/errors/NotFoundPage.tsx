import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">{t('errors.notFoundTitle')}</h1>
      <p className="mt-2 text-slate-600">{t('errors.notFoundText')}</p>
      <Link to="/" className="mt-6 inline-block text-blue-700 hover:underline">
        {t('errors.backHome')}
      </Link>
    </section>
  );
}
