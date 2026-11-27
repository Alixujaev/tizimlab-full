import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { aiFieldProps } from '@/components/ai/AiFieldBadge';
import { AiExtractButton } from '@/components/ai/AiExtractButton';
import { useAiFill } from '@/components/ai/useAiFill';
import { SubstanceSelect } from '@/components/substances/SubstanceSelect';
import { useCreateSampleMutation } from '@/hooks/useSamples';
import { getSubstanceName } from '@/lib/substances';
import type { AiExtractionDto, CreateSampleInput, SampleType, SubstanceDto } from '@/types';
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
  const [arrivalDate, setArrivalDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  // P18 (D-181): AI taklifi — faqat bo'sh maydonlarga, saqlash odatdagi "Saqlash" bilan
  const ai = useAiFill();
  /** Foydalanuvchi tahriri: qiymat + AI belgisini olib tashlash. */
  const edit = (key: string, set: (v: string) => void) => (v: string) => {
    ai.onUserEdit(key);
    set(v);
  };
  const applyAi = (x: AiExtractionDto) =>
    ai.apply(x, {
      substanceName: [substanceName, setSubstanceName],
      serialNumber: [serialNumber, setSerialNumber],
      manufacturer: [manufacturer, setManufacturer],
      manufacturedAt: [manufacturedAt, setManufacturedAt],
      expiryDate: [expiryDate, setExpiryDate],
      quantity: [quantity, setQuantity],
      arrivalDate: [arrivalDate, setArrivalDate],
      analysisEnd: [analysisEnd, setAnalysisEnd],
    });

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
    setArrivalDate('');
    setExpiryDate('');
    setNotes('');
    setErrors({});
    ai.reset();
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
    if ([manufacturedAt, analysisStart, analysisEnd, arrivalDate, expiryDate].some((d) => d && !dateRegex.test(d))) {
      next.dates = t('samples.validation.dateFormat', 'Sana formati: YYYY-MM-DD');
    } else if (expiryDate && manufacturedAt && expiryDate < manufacturedAt) {
      // Backend (D-168) bilan bir xil qoida: muddat ishlab chiqarilgan sanadan oldin emas.
      next.dates = t(
        'samples.validation.expiryBeforeManufacture',
        'Yaroqlilik muddati ishlab chiqarilgan sanadan oldin bo‘lishi mumkin emas',
      );
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
      arrivalDate: arrivalDate || null,
      expiryDate: expiryDate || null,
      notes: notes.trim() || null,
      ...(ai.reviewRef ? { ai: ai.reviewRef } : {}),
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

        <AiExtractButton kind="sample" onExtracted={applyAi} />

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
          {...aiFieldProps(ai.marks.substanceName)}
        >
          <Input
            value={substanceName}
            onChange={(e) => {
              edit('substanceName', setSubstanceName)(e.target.value);
              if (errors.substanceName)
                setErrors((prev) => ({ ...prev, substanceName: undefined }));
            }}
            placeholder={t('samples.substanceNamePlaceholder', 'Masalan: Paratsetamol')}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="sample-serial-number"
            label={t('samples.serialNumber', 'Seriya raqami')}
            {...aiFieldProps(ai.marks.serialNumber)}
          >
            <Input
              value={serialNumber}
              onChange={(e) => edit('serialNumber', setSerialNumber)(e.target.value)}
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
          <FormField
            id="sample-quantity"
            label={t('samples.quantity', 'Miqdori')}
            {...aiFieldProps(ai.marks.quantity)}
          >
            <Input
              value={quantity}
              onChange={(e) => edit('quantity', setQuantity)(e.target.value)}
              placeholder={t('samples.quantityPlaceholder', 'Masalan: 100 g yoki 5 flakon')}
            />
          </FormField>
          <FormField
            id="sample-manufacturer"
            label={t('samples.manufacturer', 'Ishlab chiqaruvchi')}
            {...aiFieldProps(ai.marks.manufacturer)}
          >
            <Input
              value={manufacturer}
              onChange={(e) => edit('manufacturer', setManufacturer)(e.target.value)}
              placeholder={t('samples.manufacturerPlaceholder', 'Kompaniya yoki zavod')}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            id="sample-manufactured-at"
            label={t('samples.manufacturedAt', 'Ishlab chiqarilgan sana')}
            {...aiFieldProps(ai.marks.manufacturedAt)}
          >
            <DatePicker
              value={manufacturedAt}
              onChange={edit('manufacturedAt', setManufacturedAt)}
            />
          </FormField>
          <FormField
            id="sample-analysis-start"
            label={t('samples.analysisStart', 'Tahlil boshlanishi')}
          >
            <DatePicker value={analysisStart} onChange={setAnalysisStart} />
          </FormField>
          <FormField
            id="sample-analysis-end"
            label={t('samples.analysisEnd', 'Tahlil tugashi')}
            {...aiFieldProps(ai.marks.analysisEnd)}
          >
            <DatePicker
              value={analysisEnd}
              onChange={edit('analysisEnd', setAnalysisEnd)}
              min={analysisStart || undefined}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="sample-arrival-date"
            label={t('samples.arrivalDate', 'Kelgan sana')}
            {...aiFieldProps(ai.marks.arrivalDate)}
          >
            <DatePicker value={arrivalDate} onChange={edit('arrivalDate', setArrivalDate)} />
          </FormField>
          <FormField
            id="sample-expiry-date"
            label={t('samples.expiryDate', 'Yaroqlilik muddati')}
            {...aiFieldProps(ai.marks.expiryDate)}
          >
            <DatePicker
              value={expiryDate}
              onChange={edit('expiryDate', setExpiryDate)}
              min={manufacturedAt || undefined}
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
