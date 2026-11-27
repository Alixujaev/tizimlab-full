import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiFieldProps } from '@/components/ai/AiFieldBadge';
import { AiExtractButton } from '@/components/ai/AiExtractButton';
import { useAiFill } from '@/components/ai/useAiFill';
import { useCreateReagentMutation, useUpdateReagentMutation } from '@/hooks/useReagents';
import { errorMessage } from '@/lib/queryClient';
import type { AiCatalogSuggestion, AiExtractionDto, ReagentDto } from '@/types';
import { Alert, Badge, Button, Checkbox, DatePicker, FormField, Input, Modal } from '@/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  reagent?: ReagentDto | null;
}

interface FieldErrors {
  name?: string;
  unit?: string;
  dates?: string;
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
  // P18 (D-183): lot maydonlari
  const [lotNumber, setLotNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  // D-174: katalog elementi — faqat foydalanuvchi AI taklifini bosganda bog'lanadi (avto emas)
  const [catalogItem, setCatalogItem] = useState<AiCatalogSuggestion | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const ai = useAiFill();
  const { reset: resetAi } = ai;

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
    setLotNumber(reagent?.lotNumber ?? '');
    setManufacturer(reagent?.manufacturer ?? '');
    setManufacturedAt(reagent?.manufacturedAt ?? '');
    setArrivalDate(reagent?.arrivalDate ?? '');
    setCatalogItem(null);
    setFieldErrors({});
    setError(null);
    resetAi();
  }, [reagent, open, resetAi]);

  /** Foydalanuvchi tahriri: qiymat + AI belgisini olib tashlash. */
  const edit = (key: string, set: (v: string) => void) => (v: string) => {
    ai.onUserEdit(key);
    set(v);
  };

  const applyAi = (x: AiExtractionDto) =>
    ai.apply(x, {
      name: [name, setName],
      lotNumber: [lotNumber, setLotNumber],
      manufacturer: [manufacturer, setManufacturer],
      manufacturedAt: [manufacturedAt, setManufacturedAt],
      expiresAt: [expiresAt, setExpiresAt],
      quantity: [quantity, setQuantity],
      unit: [unit, setUnit],
      arrivalDate: [arrivalDate, setArrivalDate],
    });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t('reagents.nameRequired', 'Reaktiv nomi kiritilishi shart');
    if (!unit.trim()) next.unit = t('reagents.unitRequired', "O'lchov birligi kiritilishi shart");
    // Backend bilan bir xil qoida: muddat ishlab chiqarilgan sanadan oldin emas
    if (expiresAt && manufacturedAt && expiresAt < manufacturedAt) {
      next.dates = t('reagents.lot.expiryBeforeManufacture');
    }
    setFieldErrors(next);
    if (next.name || next.unit || next.dates) return;

    const common = {
      name: name.trim(),
      casNumber: casNumber.trim() || null,
      unit: unit.trim(),
      lowStockThreshold: Number(lowStockThreshold) || 0,
      expiresAt: expiresAt || null,
      supplier: supplier.trim() || null,
      storageConditions: storageConditions.trim() || null,
      isHazardous,
      lotNumber: lotNumber.trim() || null,
      manufacturer: manufacturer.trim() || null,
      manufacturedAt: manufacturedAt || null,
      arrivalDate: arrivalDate || null,
    };
    try {
      if (isEditing && reagent) {
        await updateMutation.mutateAsync({ id: reagent.id, input: common });
      } else {
        await createMutation.mutateAsync({
          ...common,
          quantity: Number(quantity) || 0,
          ...(catalogItem ? { reagentItemId: catalogItem.id } : {}),
          ...(ai.reviewRef ? { ai: ai.reviewRef } : {}),
        });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const suggestions = ai.extraction?.catalogSuggestions ?? [];

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

        {!isEditing && <AiExtractButton kind="reagent" onExtracted={applyAi} />}

        <FormField
          label={t('reagents.name')}
          required
          error={fieldErrors.name}
          {...aiFieldProps(ai.marks.name)}
        >
          <Input value={name} onChange={(e) => edit('name', setName)(e.target.value)} />
        </FormField>

        {!isEditing && (catalogItem || suggestions.length > 0) && (
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-3 text-sm">
            {catalogItem ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2 text-fg">
                  <Badge tone="success" icon="check">
                    {t('reagents.catalog.linked')}
                  </Badge>
                  {catalogItem.name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setCatalogItem(null)}>
                  {t('reagents.catalog.unlink')}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-fg-muted">{t('reagents.catalog.hint')}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Button
                      key={s.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => setCatalogItem(s)}
                    >
                      {t('reagents.catalog.suggestion', { name: s.name })}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('reagents.lot.lotNumber')} {...aiFieldProps(ai.marks.lotNumber)}>
            <Input
              value={lotNumber}
              maxLength={100}
              onChange={(e) => edit('lotNumber', setLotNumber)(e.target.value)}
            />
          </FormField>
          <FormField
            label={t('reagents.lot.manufacturer')}
            {...aiFieldProps(ai.marks.manufacturer)}
          >
            <Input
              value={manufacturer}
              maxLength={255}
              onChange={(e) => edit('manufacturer', setManufacturer)(e.target.value)}
            />
          </FormField>
          <FormField label={t('reagents.casNumber')}>
            <Input value={casNumber} onChange={(e) => setCasNumber(e.target.value)} />
          </FormField>
          <FormField
            label={t('reagents.unit')}
            required
            error={fieldErrors.unit}
            {...aiFieldProps(ai.marks.unit)}
          >
            <Input value={unit} onChange={(e) => edit('unit', setUnit)(e.target.value)} />
          </FormField>
          {!isEditing && (
            <FormField label={t('reagents.quantity')} {...aiFieldProps(ai.marks.quantity)}>
              <Input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => edit('quantity', setQuantity)(e.target.value)}
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
          <FormField
            label={t('reagents.lot.manufacturedAt')}
            {...aiFieldProps(ai.marks.manufacturedAt)}
          >
            <DatePicker
              value={manufacturedAt}
              onChange={edit('manufacturedAt', setManufacturedAt)}
            />
          </FormField>
          <FormField
            label={t('reagents.expiresAt')}
            error={fieldErrors.dates}
            {...aiFieldProps(ai.marks.expiresAt)}
          >
            <DatePicker
              value={expiresAt}
              onChange={edit('expiresAt', setExpiresAt)}
              min={manufacturedAt || undefined}
            />
          </FormField>
          <FormField
            label={t('reagents.lot.arrivalDate')}
            {...aiFieldProps(ai.marks.arrivalDate)}
          >
            <DatePicker value={arrivalDate} onChange={edit('arrivalDate', setArrivalDate)} />
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
