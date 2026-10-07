import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

/** Stub: login formasi P2 da (auth endpointlari bilan) yoziladi. */
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t('pages.login')}</h1>
          <LanguageSwitcher />
        </div>
        <p className="text-slate-600">{t('auth.loginComingSoon')}</p>
      </section>
    </main>
  );
}
