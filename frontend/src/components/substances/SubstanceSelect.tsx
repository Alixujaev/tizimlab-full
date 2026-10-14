import { useTranslation } from 'react-i18next';
import { useSubstancesQuery } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import type { SubstanceDto } from '@/types';
import { FormField, Select } from '@/ui';

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

/** Faol moddalar ro'yxatidan tanlash (bo'sh qiymat — tanlovni bekor qilish). */
export function SubstanceSelect({
  id = 'substance-select',
  label,
  value,
  onChange,
  disabled,
  required,
  error,
  placeholder,
}: SubstanceSelectProps) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useSubstancesQuery({ isActive: true, limit: 100 });
  const substances = data?.data ?? [];
  const emptyLabel = placeholder ?? t('substances.selectPlaceholder', 'Moddani tanlang...');

  const options = [
    { value: '', label: emptyLabel },
    ...substances.map((s) => {
      const meta = [s.pharmacopoeia, s.casNumber ? `CAS: ${s.casNumber}` : null]
        .filter(Boolean)
        .join(', ');
      const name = getSubstanceName(s, i18n.language);
      return { value: s.id, label: meta ? `${name} (${meta})` : name };
    }),
  ];

  const select = (
    <Select
      id={id}
      options={options}
      value={value ?? ''}
      placeholder={emptyLabel}
      disabled={disabled || isLoading}
      invalid={!!error}
      onChange={(selectedId) =>
        onChange(
          selectedId,
          substances.find((s) => s.id === selectedId),
        )
      }
    />
  );

  if (!label) return select;
  return (
    <FormField id={id} label={label} required={required} error={error}>
      {select}
    </FormField>
  );
}
