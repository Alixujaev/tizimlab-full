import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import {
  useCreateSubstanceMutation,
  useSubstanceQuery,
  useUpdateSubstanceMutation,
} from '@/hooks/useSubstances';
import type { Pharmacopoeia, SubstanceDto, SubstanceParameterInput } from '@/types';
import {
  Alert,
  Button,
  Checkbox,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '@/ui';

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
  parameters?: Record<number, { parameterName?: string; range?: string }>;
  duplicateParameters?: string;
  general?: string;
}

const PHARMACOPOEIA_OPTIONS: Pharmacopoeia[] = ['EP', 'BP', 'UzDSt', 'USP', 'OTHER'];

const EMPTY_PARAM: ParameterRowState = {
  parameterName: '',
  unit: '',
  specMin: '',
  specMax: '',
  method: '',
};

export function SubstanceFormModal({ open, onClose, substance }: SubstanceFormModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const isEdit = Boolean(substance);

  // Tahrirlashda parametrlar bilan to'liq ma'lumot
  const { data: detailData, isLoading: isDetailLoading } = useSubstanceQuery(substance?.id ?? '');
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
    if (!open) return;
    setNameUz(substance?.nameUz ?? '');
    setNameRu(substance?.nameRu ?? '');
    setNameEn(substance?.nameEn ?? '');
    setPharmacopoeia(substance?.pharmacopoeia ?? 'EP');
    setCasNumber(substance?.casNumber ?? '');
    setDescription(substance?.description ?? '');
    setIsActive(substance?.isActive ?? true);
    setParameters(
      substance && detailData?.parameters
        ? detailData.parameters.map((p) => ({
            id: p.id,
            parameterName: p.parameterName,
            unit: p.unit ?? '',
            specMin: p.specMin !== null ? String(p.specMin) : '',
            specMax: p.specMax !== null ? String(p.specMax) : '',
            method: p.method ?? '',
          }))
        : [],
    );
    setErrors({});
  }, [open, substance, detailData]);

  const updateParam = (index: number, field: keyof ParameterRowState, value: string) =>
    setParameters((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const validateForm = (): boolean => {
    const next: FormErrors = {};
    if (!nameUz.trim()) {
      next.nameUz = t(
        'substances.errors.nameUzRequired',
        "Modda nomi (o'zbekcha) kiritilishi shart",
      );
    }
    const seen = new Set<string>();
    const paramErrors: Record<number, { parameterName?: string; range?: string }> = {};
    parameters.forEach((param, index) => {
      const name = param.parameterName.trim();
      if (!name) {
        paramErrors[index] = {
          ...paramErrors[index],
          parameterName: t(
            'substances.errors.paramNameRequired',
            'Parametr nomi kiritilishi shart',
          ),
        };
      } else {
        const lower = name.toLowerCase();
        if (seen.has(lower)) {
          const msg = t('substances.errors.duplicateParameter', 'Takror parametr nomi kiritilgan');
          next.duplicateParameters = msg;
          paramErrors[index] = { ...paramErrors[index], parameterName: msg };
        }
        seen.add(lower);
      }
      if (param.specMin !== '' && param.specMax !== '') {
        const min = Number(param.specMin);
        const max = Number(param.specMax);
        if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
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
    if (Object.keys(paramErrors).length > 0) next.parameters = paramErrors;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const formattedParams: SubstanceParameterInput[] = parameters.map((p, idx) => ({
      parameterName: p.parameterName.trim(),
      unit: p.unit.trim() || null,
      specMin: p.specMin !== '' ? Number(p.specMin) : null,
      specMax: p.specMax !== '' ? Number(p.specMax) : null,
      method: p.method.trim() || null,
      sortOrder: idx,
    }));
    const common = {
      nameUz: nameUz.trim(),
      nameRu: nameRu.trim() || null,
      nameEn: nameEn.trim() || null,
      pharmacopoeia,
      casNumber: casNumber.trim() || null,
      description: description.trim() || null,
      parameters: formattedParams,
    };

    try {
      if (isEdit && substance) {
        await updateMutation.mutateAsync({ id: substance.id, input: { ...common, isActive } });
      } else {
        await createMutation.mutateAsync(common);
      }
      onClose();
    } catch (err) {
      setErrors({
        general: toApiError(err)?.message ?? t('common.loadError', 'Xatolik yuz berdi'),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        isEdit
          ? t('substances.editSubstance', 'Moddani tahrirlash')
          : t('substances.newSubstance', 'Yangi modda')
      }
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
      {isEdit && isDetailLoading ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton variant="rect" className="h-9 w-full" />
          <Skeleton variant="rect" className="h-9 w-full" />
          <Skeleton variant="rect" className="h-32 w-full" />
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {errors.general && <Alert tone="danger">{errors.general}</Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              id="substance-name-uz"
              label={t('substances.nameUz', 'Nomi (O‘zbekcha)')}
              required
              error={errors.nameUz}
              disabled={isPending}
            >
              <Input value={nameUz} onChange={(e) => setNameUz(e.target.value)} />
            </FormField>
            <FormField
              id="substance-name-ru"
              label={t('substances.nameRu', 'Nomi (Ruscha)')}
              disabled={isPending}
            >
              <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
            </FormField>
            <FormField
              id="substance-name-en"
              label={t('substances.nameEn', 'Nomi (Inglizcha)')}
              disabled={isPending}
            >
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              id="substance-pharmacopoeia"
              label={t('substances.pharmacopoeia', 'Farmakopiya')}
              required
              disabled={isPending}
            >
              <Select
                options={PHARMACOPOEIA_OPTIONS.map((p) => ({ value: p, label: p }))}
                value={pharmacopoeia}
                onChange={setPharmacopoeia}
              />
            </FormField>
            <FormField
              id="substance-cas-number"
              label={t('substances.casNumber', 'CAS raqami')}
              disabled={isPending}
            >
              <Input
                value={casNumber}
                onChange={(e) => setCasNumber(e.target.value)}
                placeholder="103-90-2"
              />
            </FormField>
          </div>

          <FormField
            id="substance-description"
            label={t('substances.description', 'Tavsif')}
            disabled={isPending}
          >
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          {isEdit && (
            <Checkbox
              label={t('substances.isActive', 'Faol modda')}
              checked={isActive}
              disabled={isPending}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          )}

          {/* Dinamik parametrlar */}
          <section className="flex flex-col gap-3 border-t border-line pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-fg">
                  {t('substances.parameters', 'Modda parametrlari')}
                </h3>
                <p className="text-xs text-fg-muted">
                  {t(
                    'substances.parametersHint',
                    'Laboratoriya tahlili uchun parametr chegaralari va metodlari',
                  )}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon="plus"
                disabled={isPending}
                onClick={() => setParameters((prev) => [...prev, { ...EMPTY_PARAM }])}
              >
                {t('substances.addParameter', 'Parametr qo‘shish')}
              </Button>
            </div>

            {errors.duplicateParameters && (
              <Alert tone="danger">{errors.duplicateParameters}</Alert>
            )}

            {parameters.length === 0 ? (
              <EmptyState
                size="sm"
                icon="layers"
                title={t(
                  'substances.noParametersYet',
                  'Hozircha parametrlar qo‘shilmagan. Yuqoridagi tugma orqali qo‘shishingiz mumkin.',
                )}
                className="rounded-lg border border-dashed border-line-strong"
              />
            ) : (
              <ol className="flex flex-col gap-3">
                {parameters.map((param, index) => {
                  const paramError = errors.parameters?.[index];
                  return (
                    <li
                      key={index}
                      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-muted p-3"
                    >
                      <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-12">
                        <FormField
                          id={`param-name-${index}`}
                          label={t('substances.parameterName', 'Parametr nomi')}
                          required
                          error={paramError?.parameterName}
                          disabled={isPending}
                          className="col-span-2 md:col-span-5"
                        >
                          <Input
                            size="sm"
                            value={param.parameterName}
                            onChange={(e) => updateParam(index, 'parameterName', e.target.value)}
                            placeholder={t(
                              'substances.paramNamePlaceholder',
                              'Masalan: Erish harorati',
                            )}
                          />
                        </FormField>
                        <FormField
                          id={`param-unit-${index}`}
                          label={t('substances.unit', 'Birlik')}
                          disabled={isPending}
                          className="col-span-2 md:col-span-2"
                        >
                          <Input
                            size="sm"
                            value={param.unit}
                            onChange={(e) => updateParam(index, 'unit', e.target.value)}
                            placeholder={t('substances.unitPlaceholder', '°C, mg, %')}
                          />
                        </FormField>
                        <FormField
                          id={`param-min-${index}`}
                          label={t('substances.specMin', 'Min chegara')}
                          disabled={isPending}
                          className="md:col-span-2"
                        >
                          <Input
                            size="sm"
                            type="number"
                            step="any"
                            value={param.specMin}
                            onChange={(e) => updateParam(index, 'specMin', e.target.value)}
                            placeholder={t('substances.minPlaceholder', 'Min')}
                          />
                        </FormField>
                        <FormField
                          id={`param-max-${index}`}
                          label={t('substances.specMax', 'Max chegara')}
                          disabled={isPending}
                          className="md:col-span-2"
                        >
                          <Input
                            size="sm"
                            type="number"
                            step="any"
                            value={param.specMax}
                            onChange={(e) => updateParam(index, 'specMax', e.target.value)}
                            placeholder={t('substances.maxPlaceholder', 'Max')}
                          />
                        </FormField>
                        <div className="col-span-2 flex justify-end md:col-span-1 md:pt-6">
                          <IconButton
                            icon="trash"
                            variant="danger-ghost"
                            size="sm"
                            label={t('common.remove', 'Olib tashlash')}
                            disabled={isPending}
                            onClick={() =>
                              setParameters((prev) => prev.filter((_, i) => i !== index))
                            }
                          />
                        </div>
                      </div>
                      <FormField
                        id={`param-method-${index}`}
                        label={t('substances.method', 'Tahlil metodi (erkin matn)')}
                        disabled={isPending}
                      >
                        <Input
                          size="sm"
                          value={param.method}
                          onChange={(e) => updateParam(index, 'method', e.target.value)}
                          placeholder={t(
                            'substances.methodPlaceholder',
                            'Masalan: Spektrofotometriya, Xromatografiya',
                          )}
                        />
                      </FormField>
                      {paramError?.range && <Alert tone="danger">{paramError.range}</Alert>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </form>
      )}
    </Modal>
  );
}
