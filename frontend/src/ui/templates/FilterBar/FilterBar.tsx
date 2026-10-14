import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import { cx } from '../../lib/cx';

export interface FilterBarProps {
  /** Filtr elementlari (SearchInput, Select, DatePicker ...). */
  children: ReactNode;
  /** Faol filtr bo'lsa ko'rinadigan "Filtrlarni tozalash". */
  onReset?: () => void;
  canReset?: boolean;
  /**
   * Berilsa — filtrlar forma sifatida (Enter / "Qo'llash" bilan qo'llanadi) va to'r ko'rinishida;
   * ko'p maydonli qidiruv (reyestr, jurnal) uchun.
   */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  submitLabel?: ReactNode;
  resetLabel?: ReactNode;
  /** Forma rejimida tugmalar ustidagi qo'shimcha qator (checkbox, xato xabari). */
  extra?: ReactNode;
  className?: string;
}

/** Ro'yxat ustidagi filtrlar: desktop'da bir qatorda (yoki to'rda), mobil'da ustma-ust. */
export function FilterBar({
  children,
  onReset,
  canReset = true,
  onSubmit,
  submitLabel,
  resetLabel,
  extra,
  className,
}: FilterBarProps) {
  const { t } = useTranslation();
  const box = 'rounded-xl border border-line bg-surface shadow-sm';

  if (onSubmit) {
    return (
      <form
        role="search"
        aria-label={t('ui.filters')}
        noValidate
        onSubmit={onSubmit}
        className={cx(box, 'grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      >
        {children}
        {extra && <div className="col-span-full flex flex-col gap-3">{extra}</div>}
        <div className="col-span-full flex flex-wrap gap-2">
          <Button type="submit" leftIcon="filter">
            {submitLabel ?? t('ui.filters')}
          </Button>
          {onReset && (
            <Button variant="secondary" onClick={onReset} disabled={!canReset}>
              {resetLabel ?? t('ui.resetFilters')}
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('ui.filters')}
      className={cx(
        box,
        'flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {children}
      {onReset && canReset && (
        <Button variant="ghost" size="sm" leftIcon="x" onClick={onReset} className="sm:ml-auto">
          {resetLabel ?? t('ui.resetFilters')}
        </Button>
      )}
    </div>
  );
}
