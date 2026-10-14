import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateReagentMutation, useUpdateReagentMutation } from '@/hooks/useReagents';
import { errorMessage } from '@/lib/queryClient';
import type { ReagentDto } from '@/types';
import { Alert, Button, Checkbox, DatePicker, FormField, Input, Modal } from '@/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  reagent?: ReagentDto | null;
}

interface FieldErrors {
  name?: string;
  unit?: string;
}

export function ReagentFormModal({ open, onClose, reagent }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const createMutation = useCreateReagentMutation();
  const updateMutation = useUpdateReagentMutation();
  const isEditing = Boolean(reagent);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [unit, setUnit] = useState('g');
  const [quantity, setQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [supplier, setSupplier] = useState('');
  const [storageConditions, setStorageConditions] = useState('');
  const [isHazardous, setIsHazardous] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(reagent?.name ?? '');
    setCasNumber(reagent?.casNumber ?? '');
    setUnit(reagent?.unit ?? 'g');
    setQuantity(reagent ? String(reagent.quantity) : '0');
    setLowStockThreshold(reagent ? String(reagent.lowStockThreshold) : '0');
    setExpiresAt(reagent?.expiresAt ?? '');
    setSupplier(reagent?.supplier ?? '');
    setStorageConditions(reagent?.storageConditions ?? '');
    setIsHazardous(reagent?.isHazardous ?? false);
    setFieldErrors({});
    setError(null);
  }, [reagent, open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t('reagents.nameRequired', 'Reaktiv nomi kiritilishi shart');
    if (!unit.trim()) next.unit = t('reagents.unitRequired', "O'lchov birligi kiritilishi shart");
    setFieldErrors(next);
    if (next.name || next.unit) return;

    const common = {
      name: name.trim(),
      casNumber: casNumber.trim() || null,
      unit: unit.trim(),
      lowStockThreshold: Number(lowStockThreshold) || 0,
      expiresAt: expiresAt || null,
      supplier: supplier.trim() || null,
      storageConditions: storageConditions.trim() || null,
      isHazardous,
    };
    try {
      if (isEditing && reagent) {
        await updateMutation.mutateAsync({ id: reagent.id, input: common });
      } else {
        await createMutation.mutateAsync({ ...common, quantity: Number(quantity) || 0 });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEditing ? t('reagents.edit') : t('reagents.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button type="submit" form={formId} loading={isPending}>
            {t('common.save', 'Saqlash')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField label={t('reagents.name')} required error={fieldErrors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('reagents.casNumber')}>
            <Input value={casNumber} onChange={(e) => setCasNumber(e.target.value)} />
          </FormField>
          <FormField label={t('reagents.unit')} required error={fieldErrors.unit}>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </FormField>
          {!isEditing && (
            <FormField label={t('reagents.quantity')}>
              <Input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </FormField>
          )}
          <FormField label={t('reagents.lowStockThreshold')}>
            <Input
              type="number"
              step="any"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
          </FormField>
          <FormField label={t('reagents.expiresAt')}>
            <DatePicker value={expiresAt} onChange={setExpiresAt} />
          </FormField>
          <FormField label={t('reagents.supplier')}>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </FormField>
        </div>

        <FormField label={t('reagents.storageConditions')}>
          <Input value={storageConditions} onChange={(e) => setStorageConditions(e.target.value)} />
        </FormField>

        <Checkbox
          label={t('reagents.isHazardous')}
          checked={isHazardous}
          onChange={(e) => setIsHazardous(e.target.checked)}
        />
      </form>
    </Modal>
  );
}
