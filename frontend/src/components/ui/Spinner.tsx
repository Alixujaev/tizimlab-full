import { useTranslation } from 'react-i18next';

export function Spinner({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className={`flex items-center justify-center p-6 ${className}`}>
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
      />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
