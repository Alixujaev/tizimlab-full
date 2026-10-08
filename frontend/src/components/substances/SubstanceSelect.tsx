import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSubstancesQuery } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import type { SubstanceDto } from '@/types';

export interface SubstanceSelectProps {
  id?: string;
  label?: string;
  value?: string;
  onChange: (substanceId: string, substance?: SubstanceDto) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

export const SubstanceSelect: React.FC<SubstanceSelectProps> = ({
  id = 'substance-select',
  label,
  value,
  onChange,
  disabled,
  required,
  error,
  placeholder,
}) => {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useSubstancesQuery({ isActive: true, limit: 100 });
  const substances = data?.data ?? [];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const found = substances.find((s) => s.id === selectedId);
    onChange(selectedId, found);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={id}
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled || isLoading}
        className={`w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
        } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-70' : ''}`}
      >
        <option value="">
          {placeholder ?? t('substances.selectPlaceholder', 'Moddani tanlang...')}
        </option>
        {substances.map((s) => {
          const name = getSubstanceName(s, i18n.language);
          const meta = [s.pharmacopoeia, s.casNumber ? `CAS: ${s.casNumber}` : null]
            .filter(Boolean)
            .join(', ');
          return (
            <option key={s.id} value={s.id}>
              {name} {meta ? `(${meta})` : ''}
            </option>
          );
        })}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
