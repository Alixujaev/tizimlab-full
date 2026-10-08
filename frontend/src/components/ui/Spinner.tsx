import { useTranslation } from 'react-i18next';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className = '', size = 'md' }: SpinnerProps) {
  const { t } = useTranslation();
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-2',
  }[size];
  const padding = size === 'sm' ? 'p-0' : 'p-6';

  return (
    <div role="status" className={`flex items-center justify-center ${padding} ${className}`}>
      <span
        aria-hidden="true"
        className={`animate-spin rounded-full border-slate-300 border-t-current ${sizeClasses}`}
      />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
