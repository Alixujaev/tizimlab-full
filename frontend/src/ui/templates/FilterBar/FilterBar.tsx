import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import { cx } from '../../lib/cx';

export interface FilterBarProps {
  /** Filtr elementlari (SearchInput, Select, DatePicker ...). */
  children: ReactNode;
  /** Faol filtr bo'lsa ko'rinadigan "Filtrlarni tozalash". */
  onReset?: () => void;
  canReset?: boolean;
  className?: string;
}

/** Ro'yxat ustidagi filtrlar qatori: desktop'da bir qatorda, mobil'da ustma-ust. */
export function FilterBar({ children, onReset, canReset = true, className }: FilterBarProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('ui.filters')}
      className={cx(
        'flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {children}
      {onReset && canReset && (
        <Button variant="ghost" size="sm" leftIcon="x" onClick={onReset} className="sm:ml-auto">
          {t('ui.resetFilters')}
        </Button>
      )}
    </div>
  );
}
