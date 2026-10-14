import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { SubstanceSelect } from '@/components/substances/SubstanceSelect';
import { useCreateSampleMutation } from '@/hooks/useSamples';
import { getSubstanceName } from '@/lib/substances';
import type { CreateSampleInput, SampleType, SubstanceDto } from '@/types';
import { Alert, Button, DatePicker, FormField, Input, Modal, Select, Textarea } from '@/ui';

interface SampleFormModalProps {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_TYPES: SampleType[] = [
  'raw_material',
  'finished_product',
  'reagent',
  'standard_substance',
  'other',
];

interface FormErrors {
  substanceName?: string;
  dates?: string;
  general?: string;
}

export function SampleFormModal({ open, onClose }: SampleFormModalProps) {
  const { t, i18n } = useTranslation();
  const formId = useId();
  const createMutation = useCreateSampleMutation();

  const [type, setType] = useState<SampleType>('raw_material');
  const [substanceId, setSubstanceId] = useState('');
  const [substanceName, setSubstanceName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [analysisStart, setAnalysisStart] = useState('');
  const [analysisEnd, setAnalysisEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const resetForm = () => {
    setType('raw_material');
    setSubstanceId('');
    setSubstanceName('');
    setSerialNumber('');
    setLotNumber('');
    setQuantity('');
    setManufacturer('');
    setManufacturedAt('');
    setAnalysisStart('');
    setAnalysisEnd('');
    setNotes('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubstanceSelect = (id: string, substance?: SubstanceDto) => {
    setSubstanceId(id);
    if (substance) setSubstanceName(getSubstanceName(substance, i18n.language));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!substanceName.trim()) {
      next.substanceName = t(
        'samples.validation.substanceRequired',
        'Modda nomi kiritilishi shart',
      );
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if ([manufacturedAt, analysisStart, analysisEnd].some((d) => d && !dateRegex.test(d))) {
      next.dates = t('samples.validation.dateFormat', 'Sana formati: YYYY-MM-DD');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateSampleInput = {
      type,
      substanceId: substanceId || null,
      substanceName: substanceName.trim(),
      serialNumber: serialNumber.trim() || null,
      lotNumber: lotNumber.trim() || null,
      quantity: quantity.trim() || null,
      manufacturer: manufacturer.trim() || null,
      manufacturedAt: manufacturedAt || null,
      analysisStart: analysisStart || null,
      analysisEnd: analysisEnd || null,
      notes: notes.trim() || null,
    };

    try {
      await createMutation.mutateAsync(payload);
      handleClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setErrors((prev) => ({
        ...prev,
        general: apiErr?.message ?? t('common.loadError', 'Xatolik yuz berdi'),
      }));
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={t('samples.newSample', 'Yangi namuna kiritish')}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={createMutation.isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button type="submit" form={formId} loading={createMutation.isPending}>
            {t('common.save', 'Saqlash')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.general && <Alert tone="danger">{errors.general}</Alert>}

        <FormField id="sample-type" label={t('samples.type', 'Namuna turi')} required>
          <Select
            options={SAMPLE_TYPES.map((v) => ({ value: v, label: t(`samples.types.${v}`, v) }))}
            value={type}
            onChange={setType}
          />
        </FormField>

        <SubstanceSelect
          id="sample-substance-select"
          label={t('samples.chooseSubstance', 'Moddalar bazasidan tanlash (ixtiyoriy)')}
          value={substanceId}
          onChange={handleSubstanceSelect}
        />

        <FormField
          id="sample-substance-name"
          label={t('samples.substanceName', 'Modda nomi')}
          required
          error={errors.substanceName}
        >
          <Input
            value={substanceName}
            onChange={(e) => {
              setSubstanceName(e.target.value);
              if (errors.substanceName)
                setErrors((prev) => ({ ...prev, substanceName: undefined }));
            }}
            placeholder={t('samples.substanceNamePlaceholder', 'Masalan: Paratsetamol')}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="sample-serial-number" label={t('samples.serialNumber', 'Seriya raqami')}>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder={t('samples.serialNumberPlaceholder', 'Masalan: SN-12345')}
            />
          </FormField>
          <FormField id="sample-lot-number" label={t('samples.lotNumber', 'Partiya (Lot) raqami')}>
            <Input
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder={t('samples.lotNumberPlaceholder', 'Masalan: LOT-998')}
            />
          </FormField>
          <FormField id="sample-quantity" label={t('samples.quantity', 'Miqdori')}>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t('samples.quantityPlaceholder', 'Masalan: 100 g yoki 5 flakon')}
            />
          </FormField>
          <FormField
            id="sample-manufacturer"
            label={t('samples.manufacturer', 'Ishlab chiqaruvchi')}
          >
            <Input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder={t('samples.manufacturerPlaceholder', 'Kompaniya yoki zavod')}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            id="sample-manufactured-at"
            label={t('samples.manufacturedAt', 'Ishlab chiqarilgan sana')}
          >
            <DatePicker value={manufacturedAt} onChange={setManufacturedAt} />
          </FormField>
          <FormField
            id="sample-analysis-start"
            label={t('samples.analysisStart', 'Tahlil boshlanishi')}
          >
            <DatePicker value={analysisStart} onChange={setAnalysisStart} />
          </FormField>
          <FormField id="sample-analysis-end" label={t('samples.analysisEnd', 'Tahlil tugashi')}>
            <DatePicker
              value={analysisEnd}
              onChange={setAnalysisEnd}
              min={analysisStart || undefined}
            />
          </FormField>
        </div>
        {errors.dates && <Alert tone="danger">{errors.dates}</Alert>}

        <FormField id="sample-notes" label={t('samples.notes', 'Qo‘shimcha izohlar')}>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(
              'samples.notesPlaceholder',
              'Maxsus ko‘rsatmalar yoki saqlash sharoiti...',
            )}
          />
        </FormField>
      </form>
    </Modal>
  );
}
