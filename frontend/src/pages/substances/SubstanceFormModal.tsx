import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  useCreateSubstanceMutation,
  useSubstanceQuery,
  useUpdateSubstanceMutation,
} from '@/hooks/useSubstances';
import type {
  Pharmacopoeia,
  SubstanceDto,
  SubstanceParameterInput,
} from '@/types';

interface SubstanceFormModalProps {
  open: boolean;
  onClose: () => void;
  substance: SubstanceDto | null;
}

interface ParameterRowState {
  id?: string;
  parameterName: string;
  unit: string;
  specMin: string;
  specMax: string;
  method: string;
}

interface FormErrors {
  nameUz?: string;
  pharmacopoeia?: string;
  parameters?: Record<number, { parameterName?: string; range?: string }>;
  duplicateParameters?: string;
  general?: string;
}

const PHARMACOPOEIA_OPTIONS: Pharmacopoeia[] = ['EP', 'BP', 'UzDSt', 'USP', 'OTHER'];

export function SubstanceFormModal({ open, onClose, substance }: SubstanceFormModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(substance);

  // If edit, fetch full detail with parameters
  const { data: detailData, isLoading: isDetailLoading } = useSubstanceQuery(
    substance?.id ?? '',
  );

  const createMutation = useCreateSubstanceMutation();
  const updateMutation = useUpdateSubstanceMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [nameUz, setNameUz] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [pharmacopoeia, setPharmacopoeia] = useState<Pharmacopoeia>('EP');
  const [casNumber, setCasNumber] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [parameters, setParameters] = useState<ParameterRowState[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (substance) {
        setNameUz(substance.nameUz);
        setNameRu(substance.nameRu ?? '');
        setNameEn(substance.nameEn ?? '');
        setPharmacopoeia(substance.pharmacopoeia);
        setCasNumber(substance.casNumber ?? '');
        setDescription(substance.description ?? '');
        setIsActive(substance.isActive);

        if (detailData?.parameters) {
          setParameters(
            detailData.parameters.map((p) => ({
              id: p.id,
              parameterName: p.parameterName,
              unit: p.unit ?? '',
              specMin: p.specMin !== null ? String(p.specMin) : '',
              specMax: p.specMax !== null ? String(p.specMax) : '',
              method: p.method ?? '',
            })),
          );
        } else {
          setParameters([]);
        }
      } else {
        setNameUz('');
        setNameRu('');
        setNameEn('');
        setPharmacopoeia('EP');
        setCasNumber('');
        setDescription('');
        setIsActive(true);
        setParameters([]);
      }
      setErrors({});
    }
  }, [open, substance, detailData]);

  const handleAddParameter = () => {
    setParameters((prev) => [
      ...prev,
      {
        parameterName: '',
        unit: '',
        specMin: '',
        specMax: '',
        method: '',
      },
    ]);
  };

  const handleRemoveParameter = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParameterChange = (
    index: number,
    field: keyof ParameterRowState,
    value: string,
  ) => {
    setParameters((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nameUz.trim()) {
      newErrors.nameUz = t('substances.errors.nameUzRequired', "Modda nomi (o'zbekcha) kiritilishi shart");
    }

    const seenNames = new Set<string>();
    const paramErrors: Record<number, { parameterName?: string; range?: string }> = {};

    parameters.forEach((param, index) => {
      const trimmedName = param.parameterName.trim();
      if (!trimmedName) {
        paramErrors[index] = {
          ...paramErrors[index],
          parameterName: t('substances.errors.paramNameRequired', 'Parametr nomi kiritilishi shart'),
        };
      } else {
        const lowerName = trimmedName.toLowerCase();
        if (seenNames.has(lowerName)) {
          newErrors.duplicateParameters = t(
            'substances.errors.duplicateParameter',
            'Takror parametr nomi kiritilgan',
          );
          paramErrors[index] = {
            ...paramErrors[index],
            parameterName: t('substances.errors.duplicateParameter', 'Takror parametr nomi kiritilgan'),
          };
        }
        seenNames.add(lowerName);
      }

      if (param.specMin !== '' && param.specMax !== '') {
        const min = Number(param.specMin);
        const max = Number(param.specMax);
        if (!isNaN(min) && !isNaN(max) && min > max) {
          paramErrors[index] = {
            ...paramErrors[index],
            range: t(
              'substances.errors.minGreaterThanMax',
              "Minimal qiymat maksimal qiymatdan katta bo'lishi mumkin emas",
            ),
          };
        }
      }
    });

    if (Object.keys(paramErrors).length > 0) {
      newErrors.parameters = paramErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const formattedParams: SubstanceParameterInput[] = parameters.map((p, idx) => ({
      parameterName: p.parameterName.trim(),
      unit: p.unit.trim() ? p.unit.trim() : null,
      specMin: p.specMin !== '' ? Number(p.specMin) : null,
      specMax: p.specMax !== '' ? Number(p.specMax) : null,
      method: p.method.trim() ? p.method.trim() : null,
      sortOrder: idx,
    }));

    try {
      if (isEdit && substance) {
        await updateMutation.mutateAsync({
          id: substance.id,
          input: {
            nameUz: nameUz.trim(),
            nameRu: nameRu.trim() ? nameRu.trim() : null,
            nameEn: nameEn.trim() ? nameEn.trim() : null,
            pharmacopoeia,
            casNumber: casNumber.trim() ? casNumber.trim() : null,
            description: description.trim() ? description.trim() : null,
            isActive,
            parameters: formattedParams,
          },
        });
      } else {
        await createMutation.mutateAsync({
          nameUz: nameUz.trim(),
          nameRu: nameRu.trim() ? nameRu.trim() : null,
          nameEn: nameEn.trim() ? nameEn.trim() : null,
          pharmacopoeia,
          casNumber: casNumber.trim() ? casNumber.trim() : null,
          description: description.trim() ? description.trim() : null,
          parameters: formattedParams,
        });
      }
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setErrors({ general: apiErr?.message ?? t('common.loadError', 'Xatolik yuz berdi') });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? t('substances.editSubstance', 'Moddani tahrirlash')
          : t('substances.newSubstance', 'Yangi modda')
      }
    >
      {isEdit && isDetailLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="substance-name-uz" className="block text-sm font-medium text-slate-700">
                {t('substances.nameUz', 'Nomi (O‘zbekcha)')}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="substance-name-uz"
                type="text"
                value={nameUz}
                onChange={(e) => setNameUz(e.target.value)}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              />
              {errors.nameUz && (
                <p className="mt-1 text-xs text-red-600">{errors.nameUz}</p>
              )}
            </div>

            <div>
              <label htmlFor="substance-name-ru" className="block text-sm font-medium text-slate-700">
                {t('substances.nameRu', 'Nomi (Ruscha)')}
              </label>
              <input
                id="substance-name-ru"
                type="text"
                value={nameRu}
                onChange={(e) => setNameRu(e.target.value)}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label htmlFor="substance-name-en" className="block text-sm font-medium text-slate-700">
                {t('substances.nameEn', 'Nomi (Inglizcha)')}
              </label>
              <input
                id="substance-name-en"
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="substance-pharmacopoeia" className="block text-sm font-medium text-slate-700">
                {t('substances.pharmacopoeia', 'Farmakopiya')}{' '}
                <span className="text-red-500">*</span>
              </label>
              <select
                id="substance-pharmacopoeia"
                value={pharmacopoeia}
                onChange={(e) => setPharmacopoeia(e.target.value as Pharmacopoeia)}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              >
                {PHARMACOPOEIA_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="substance-cas-number" className="block text-sm font-medium text-slate-700">
                {t('substances.casNumber', 'CAS raqami')}
              </label>
              <input
                id="substance-cas-number"
                type="text"
                value={casNumber}
                onChange={(e) => setCasNumber(e.target.value)}
                disabled={isPending}
                placeholder="103-90-2"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="substance-description" className="block text-sm font-medium text-slate-700">
              {t('substances.description', 'Tavsif')}
            </label>
            <textarea
              id="substance-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                id="substance-is-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="substance-is-active" className="text-sm font-medium text-slate-700">
                {t('substances.isActive', 'Faol modda')}
              </label>
            </div>
          )}

          {/* Dinamik parametrlar bo'limi */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {t('substances.parameters', 'Modda parametrlari')}
                </h4>
                <p className="text-xs text-slate-500">
                  {t('substances.parametersHint', 'Laboratoriya tahlili uchun parametr chegaralari va metodlari')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddParameter}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                + {t('substances.addParameter', 'Parametr qo‘shish')}
              </button>
            </div>

            {errors.duplicateParameters && (
              <p className="mb-2 text-xs text-red-600 font-medium">
                {errors.duplicateParameters}
              </p>
            )}

            {parameters.length === 0 ? (
              <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-md text-slate-500 text-xs">
                {t('substances.noParametersYet', 'Hozircha parametrlar qo‘shilmagan. Yuqoridagi tugma orqali qo‘shishingiz mumkin.')}
              </div>
            ) : (
              <div className="space-y-3">
                {parameters.map((param, index) => {
                  const paramError = errors.parameters?.[index];
                  return (
                    <div
                      key={index}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-md relative flex flex-col gap-2"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                        <div className="md:col-span-4">
                          <label
                            htmlFor={`param-name-${index}`}
                            className="block text-xs font-medium text-slate-600 mb-0.5"
                          >
                            {t('substances.parameterName', 'Parametr nomi')}{' '}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`param-name-${index}`}
                            type="text"
                            value={param.parameterName}
                            onChange={(e) =>
                              handleParameterChange(index, 'parameterName', e.target.value)
                            }
                            disabled={isPending}
                            placeholder={t('substances.paramNamePlaceholder', 'Masalan: Erish harorati')}
                            className={`w-full rounded border px-2.5 py-1.5 text-xs bg-white focus:outline-none ${
                              paramError?.parameterName
                                ? 'border-red-500 ring-1 ring-red-500'
                                : 'border-slate-300 focus:border-blue-500'
                            }`}
                          />
                          {paramError?.parameterName && (
                            <p className="text-[10px] text-red-600 mt-0.5">
                              {paramError.parameterName}
                            </p>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor={`param-unit-${index}`}
                            className="block text-xs font-medium text-slate-600 mb-0.5"
                          >
                            {t('substances.unit', 'Birlik')}
                          </label>
                          <input
                            id={`param-unit-${index}`}
                            type="text"
                            value={param.unit}
                            onChange={(e) =>
                              handleParameterChange(index, 'unit', e.target.value)
                            }
                            disabled={isPending}
                            placeholder={t('substances.unitPlaceholder', '°C, mg, %')}
                            className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor={`param-min-${index}`}
                            className="block text-xs font-medium text-slate-600 mb-0.5"
                          >
                            {t('substances.specMin', 'Min chegara')}
                          </label>
                          <input
                            id={`param-min-${index}`}
                            type="number"
                            step="any"
                            value={param.specMin}
                            onChange={(e) =>
                              handleParameterChange(index, 'specMin', e.target.value)
                            }
                            disabled={isPending}
                            placeholder={t('substances.minPlaceholder', 'Min')}
                            className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor={`param-max-${index}`}
                            className="block text-xs font-medium text-slate-600 mb-0.5"
                          >
                            {t('substances.specMax', 'Max chegara')}
                          </label>
                          <input
                            id={`param-max-${index}`}
                            type="number"
                            step="any"
                            value={param.specMax}
                            onChange={(e) =>
                              handleParameterChange(index, 'specMax', e.target.value)
                            }
                            disabled={isPending}
                            placeholder={t('substances.maxPlaceholder', 'Max')}
                            className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="md:col-span-2 flex items-center justify-end pt-5">
                          <button
                            type="button"
                            onClick={() => handleRemoveParameter(index)}
                            disabled={isPending}
                            className="text-red-500 hover:text-red-700 text-xs p-1"
                          >
                            {t('common.remove', 'Olib tashlash')}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`param-method-${index}`}
                          className="block text-xs font-medium text-slate-600 mb-0.5"
                        >
                          {t('substances.method', 'Tahlil metodi (erkin matn)')}
                        </label>
                        <input
                          id={`param-method-${index}`}
                          type="text"
                          value={param.method}
                          onChange={(e) =>
                            handleParameterChange(index, 'method', e.target.value)
                          }
                          disabled={isPending}
                          placeholder={t('substances.methodPlaceholder', 'Masalan: Spektrofotometriya, Xromatografiya')}
                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {paramError?.range && (
                        <p className="text-[10px] text-red-600 font-medium">
                          {paramError.range}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('common.cancel', 'Bekor qilish')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isPending && <Spinner size="sm" />}
              {t('common.save', 'Saqlash')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
