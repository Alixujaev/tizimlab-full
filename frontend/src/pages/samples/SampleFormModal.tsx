import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { SubstanceSelect } from '@/components/substances/SubstanceSelect';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useCreateSampleMutation } from '@/hooks/useSamples';
import { getSubstanceName } from '@/lib/substances';
import type { CreateSampleInput, SampleType, SubstanceDto } from '@/types';

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

export const SampleFormModal: React.FC<SampleFormModalProps> = ({ open, onClose }) => {
  const { t, i18n } = useTranslation();
  const createMutation = useCreateSampleMutation();

  const [type, setType] = useState<SampleType>('raw_material');
  const [substanceId, setSubstanceId] = useState<string>('');
  const [substanceName, setSubstanceName] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [lotNumber, setLotNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [manufacturedAt, setManufacturedAt] = useState<string>('');
  const [analysisStart, setAnalysisStart] = useState<string>('');
  const [analysisEnd, setAnalysisEnd] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [errors, setErrors] = useState<{ substanceName?: string; dates?: string; general?: string }>({});

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
    if (substance) {
      setSubstanceName(getSubstanceName(substance, i18n.language));
    }
  };

  const validate = (): boolean => {
    const newErrors: { substanceName?: string; dates?: string; general?: string } = {};
    if (!substanceName.trim()) {
      newErrors.substanceName = t('samples.validation.substanceRequired', 'Modda nomi kiritilishi shart');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (manufacturedAt && !dateRegex.test(manufacturedAt)) {
      newErrors.dates = t('samples.validation.dateFormat', 'Sana formati: YYYY-MM-DD');
    }
    if (analysisStart && !dateRegex.test(analysisStart)) {
      newErrors.dates = t('samples.validation.dateFormat', 'Sana formati: YYYY-MM-DD');
    }
    if (analysisEnd && !dateRegex.test(analysisEnd)) {
      newErrors.dates = t('samples.validation.dateFormat', 'Sana formati: YYYY-MM-DD');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      title={t('samples.newSample', 'Yangi namuna kiritish')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {errors.general}
          </div>
        )}

        {/* Namuna turi */}
        <div>
          <label htmlFor="sample-type" className="block text-sm font-medium text-slate-700 mb-1">
            {t('samples.type', 'Namuna turi')} <span className="text-red-500">*</span>
          </label>
          <select
            id="sample-type"
            value={type}
            onChange={(e) => setType(e.target.value as SampleType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SAMPLE_TYPES.map((tVal) => (
              <option key={tVal} value={tVal}>
                {t(`samples.types.${tVal}`, tVal)}
              </option>
            ))}
          </select>
        </div>

        {/* Modda tanlash */}
        <div>
          <SubstanceSelect
            id="sample-substance-select"
            label={t('samples.chooseSubstance', 'Moddalar bazasidan tanlash (ixtiyoriy)')}
            value={substanceId}
            onChange={handleSubstanceSelect}
          />
        </div>

        {/* Modda nomi */}
        <div>
          <label htmlFor="sample-substance-name" className="block text-sm font-medium text-slate-700 mb-1">
            {t('samples.substanceName', 'Modda nomi')} <span className="text-red-500">*</span>
          </label>
          <input
            id="sample-substance-name"
            type="text"
            value={substanceName}
            onChange={(e) => {
              setSubstanceName(e.target.value);
              if (errors.substanceName) setErrors((prev) => ({ ...prev, substanceName: undefined }));
            }}
            placeholder={t('samples.substanceNamePlaceholder', 'Masalan: Paratsetamol')}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              errors.substanceName
                ? 'border-red-500 focus:ring-red-200'
                : 'border-slate-300 focus:ring-blue-500'
            }`}
          />
          {errors.substanceName && (
            <p className="mt-1 text-xs text-red-500">{errors.substanceName}</p>
          )}
        </div>

        {/* Seriya va Lot raqami */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="sample-serial-number" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.serialNumber', 'Seriya raqami')}
            </label>
            <input
              id="sample-serial-number"
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder={t('samples.serialNumberPlaceholder', 'Masalan: SN-12345')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="sample-lot-number" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.lotNumber', 'Partiya (Lot) raqami')}
            </label>
            <input
              id="sample-lot-number"
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder={t('samples.lotNumberPlaceholder', 'Masalan: LOT-998')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Miqdor va Ishlab chiqaruvchi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="sample-quantity" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.quantity', 'Miqdori')}
            </label>
            <input
              id="sample-quantity"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t('samples.quantityPlaceholder', 'Masalan: 100 g yoki 5 flakon')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="sample-manufacturer" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.manufacturer', 'Ishlab chiqaruvchi')}
            </label>
            <input
              id="sample-manufacturer"
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder={t('samples.manufacturerPlaceholder', 'Kompaniya yoki zavod')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sanalar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="sample-manufactured-at" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.manufacturedAt', 'Ishlab chiqarilgan sana')}
            </label>
            <input
              id="sample-manufactured-at"
              type="date"
              value={manufacturedAt}
              onChange={(e) => setManufacturedAt(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="sample-analysis-start" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.analysisStart', 'Tahlil boshlanishi')}
            </label>
            <input
              id="sample-analysis-start"
              type="date"
              value={analysisStart}
              onChange={(e) => setAnalysisStart(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="sample-analysis-end" className="block text-sm font-medium text-slate-700 mb-1">
              {t('samples.analysisEnd', 'Tahlil tugashi')}
            </label>
            <input
              id="sample-analysis-end"
              type="date"
              value={analysisEnd}
              onChange={(e) => setAnalysisEnd(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {errors.dates && (
          <p className="text-xs text-red-500">{errors.dates}</p>
        )}

        {/* Izohlar */}
        <div>
          <label htmlFor="sample-notes" className="block text-sm font-medium text-slate-700 mb-1">
            {t('samples.notes', 'Qo‘shimcha izohlar')}
          </label>
          <textarea
            id="sample-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('samples.notesPlaceholder', 'Maxsus ko‘rsatmalar yoki saqlash sharoiti...')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tugmalar */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {createMutation.isPending && <Spinner size="sm" />}
            {t('common.save', 'Saqlash')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
