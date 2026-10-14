import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSamplesQuery } from '@/hooks/useSamples';
import { useCreateStudyMutation } from '@/hooks/useStability';
import { errorMessage } from '@/lib/queryClient';
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
} from '@/ui';

interface CreateStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSampleId?: string;
  onSuccess?: (studyId: string) => void;
}

// Odatiy boshlang'ich parametrlar (ma'lumot — tahrirlanadi)
const DEFAULT_PARAMS = [
  'Tavsif (Description)',
  'Assay',
  'Namlik miqdori (Water content)',
  "Qo'shimcha aralashmalar (Related substances)",
  'Eruvchanlik (Dissolution)',
];

const isoInDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

interface ParamRow {
  parameter: string;
  initialValue: string;
  specification: string;
}

interface CheckpointRow {
  intervalTag: string;
  dueDate: string;
}

export function CreateStudyModal({
  isOpen,
  onClose,
  preselectedSampleId,
  onSuccess,
}: CreateStudyModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useCreateStudyMutation();
  const { data: samplesData, isLoading: loadingSamples } = useSamplesQuery({
    status: 'approved',
    limit: 100,
  });

  const [sampleId, setSampleId] = useState(preselectedSampleId ?? '');
  const [storageConditions, setStorageConditions] = useState('25°C ± 2°C / 60% ± 5% RH');
  const [startedAt, setStartedAt] = useState(isoInDays(0));
  const [parameters, setParameters] = useState<ParamRow[]>(
    DEFAULT_PARAMS.map((p) => ({ parameter: p, initialValue: '', specification: '' })),
  );
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([
    { intervalTag: 'T3', dueDate: isoInDays(90) },
    { intervalTag: 'T6', dueDate: isoInDays(180) },
    { intervalTag: 'T12', dueDate: isoInDays(365) },
  ]);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateParam = (i: number, field: keyof ParamRow, value: string) =>
    setParameters((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  const updateCheckpoint = (i: number, field: keyof CheckpointRow, value: string) =>
    setCheckpoints((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sampleId) {
      setSampleError(t('stability.selectSample', 'Tasdiqlangan namunani tanlang'));
      return;
    }
    setSampleError(null);
    const validParams = parameters.filter((p) => p.parameter.trim() !== '');
    if (validParams.length === 0) {
      setError(t('stability.paramRequired', 'Kamida bitta parametr talab qilinadi'));
      return;
    }
    const validCheckpoints = checkpoints.filter((cp) => cp.intervalTag.trim() !== '' && cp.dueDate);
    try {
      const created = await mutation.mutateAsync({
        sampleId,
        storageConditions: storageConditions.trim() || null,
        startedAt,
        parameters: validParams.map((p) => ({
          parameter: p.parameter.trim(),
          initialValue: p.initialValue.trim() || null,
          specification: p.specification.trim() || null,
        })),
        checkpoints:
          validCheckpoints.length > 0
            ? validCheckpoints.map((cp) => ({
                intervalTag: cp.intervalTag.trim(),
                dueDate: cp.dueDate,
              }))
            : undefined,
      });
      onClose();
      if (onSuccess && created?.id) onSuccess(created.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const approvedSamples = samplesData?.data ?? [];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={t('stability.newStudy')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('stability.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {t('stability.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField label={t('stability.sample')} required error={sampleError}>
          {loadingSamples ? (
            <div role="status">
              <span className="sr-only">{t('common.loading', 'Yuklanmoqda...')}</span>
              <Skeleton variant="rect" className="h-9 w-full" />
            </div>
          ) : (
            <Select
              options={approvedSamples.map((s) => ({
                value: s.id,
                label: `${s.substanceName} (${s.serialNumber || s.lotNumber || t('stability.noSerial')}) · ${t(`samples.types.${s.type}`)}`,
              }))}
              value={sampleId}
              placeholder={t('stability.selectSample')}
              onChange={(v) => {
                setSampleId(v);
                setSampleError(null);
              }}
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('stability.startedAt')}>
            <DatePicker value={startedAt} onChange={setStartedAt} />
          </FormField>
          <FormField label={t('stability.storageConditions')}>
            <Input
              value={storageConditions}
              onChange={(e) => setStorageConditions(e.target.value)}
              placeholder={t('stability.storageConditionsPlaceholder')}
            />
          </FormField>
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">{t('stability.parameters')}</h3>
            <Button
              variant="ghost"
              size="sm"
              leftIcon="plus"
              onClick={() =>
                setParameters((p) => [...p, { parameter: '', initialValue: '', specification: '' }])
              }
            >
              {t('stability.addParam')}
            </Button>
          </div>
          <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
            {parameters.map((p, idx) => (
              <li
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border border-line bg-surface-muted p-2"
              >
                <Input
                  size="sm"
                  className="col-span-12 sm:col-span-5"
                  aria-label={t('stability.paramNamePlaceholder')}
                  value={p.parameter}
                  onChange={(e) => updateParam(idx, 'parameter', e.target.value)}
                  placeholder={t('stability.paramNamePlaceholder')}
                />
                <Input
                  size="sm"
                  className="col-span-5 sm:col-span-3"
                  aria-label={t('stability.initialValuePlaceholder')}
                  value={p.initialValue}
                  onChange={(e) => updateParam(idx, 'initialValue', e.target.value)}
                  placeholder={t('stability.initialValuePlaceholder')}
                />
                <Input
                  size="sm"
                  className="col-span-5 sm:col-span-3"
                  aria-label={t('stability.specPlaceholder')}
                  value={p.specification}
                  onChange={(e) => updateParam(idx, 'specification', e.target.value)}
                  placeholder={t('stability.specPlaceholder')}
                />
                <IconButton
                  icon="x"
                  size="sm"
                  label={t('common.delete', 'O‘chirish')}
                  className="col-span-2 justify-self-end sm:col-span-1"
                  onClick={() => setParameters((prev) => prev.filter((_, i) => i !== idx))}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">{t('stability.checkpoints')}</h3>
            <Button
              variant="ghost"
              size="sm"
              leftIcon="plus"
              onClick={() => setCheckpoints((c) => [...c, { intervalTag: '', dueDate: '' }])}
            >
              {t('stability.addCheckpoint')}
            </Button>
          </div>
          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {checkpoints.map((cp, idx) => (
              <li
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border border-line bg-surface-muted p-2"
              >
                <Input
                  size="sm"
                  className="col-span-4"
                  aria-label={t('stability.checkpointNamePlaceholder')}
                  value={cp.intervalTag}
                  onChange={(e) => updateCheckpoint(idx, 'intervalTag', e.target.value)}
                  placeholder={t('stability.checkpointNamePlaceholder')}
                />
                <DatePicker
                  size="sm"
                  className="col-span-6 sm:col-span-7"
                  aria-label={t('stability.dueDate')}
                  value={cp.dueDate}
                  onChange={(v) => updateCheckpoint(idx, 'dueDate', v)}
                />
                <IconButton
                  icon="x"
                  size="sm"
                  label={t('common.delete', 'O‘chirish')}
                  className="col-span-2 justify-self-end sm:col-span-1"
                  onClick={() => setCheckpoints((prev) => prev.filter((_, i) => i !== idx))}
                />
              </li>
            ))}
          </ul>
        </section>
      </form>
    </Modal>
  );
}
