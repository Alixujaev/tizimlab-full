import { useTranslation } from 'react-i18next';
import { useEquipmentQuery } from '@/hooks/useP17';
import { FormField, Select } from '@/ui';

/** "Noma'lum" — apparat ko'rsatilmagan (null); oqim hech qachon bloklanmaydi. */
export const UNKNOWN_EQUIPMENT = 'unknown';

/** P18 (D-184): yuborishda apparat tanlovi (majburiy tanlov, lekin "Noma'lum" varianti bilan). */
export function ProtocolEquipmentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useEquipmentQuery({ limit: 100 });
  return (
    <FormField
      id="protocol-equipment"
      label={t('protocols.equipment.label')}
      hint={t('protocols.equipment.hint')}
      required
      className="w-full sm:w-72"
    >
      <Select
        disabled={isLoading}
        options={[
          { value: UNKNOWN_EQUIPMENT, label: t('protocols.equipment.unknown') },
          ...(data?.data ?? []).map((eq) => ({
            value: eq.id,
            label: `${eq.name} (${eq.category})`,
          })),
        ]}
        value={value}
        onChange={onChange}
      />
    </FormField>
  );
}
