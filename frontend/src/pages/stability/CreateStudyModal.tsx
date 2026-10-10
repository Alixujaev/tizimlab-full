import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { useSamplesQuery } from '@/hooks/useSamples';
import { useCreateStudyMutation } from '@/hooks/useStability';

interface CreateStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSampleId?: string;
  onSuccess?: (studyId: string) => void;
}

const DEFAULT_PARAMS = [
  'Tavsif (Description)',
  'Assay',
  'Namlik miqdori (Water content)',
  "Qo'shimcha aralashmalar (Related substances)",
  'Eruvchanlik (Dissolution)',
];

export const CreateStudyModal: React.FC<CreateStudyModalProps> = ({
  isOpen,
  onClose,
  preselectedSampleId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const mutation = useCreateStudyMutation();
  const { data: samplesData, isLoading: loadingSamples } = useSamplesQuery({
    status: 'approved',
    limit: 100,
  });

  const [sampleId, setSampleId] = useState(preselectedSampleId ?? '');
  const [storageConditions, setStorageConditions] = useState('25°C ± 2°C / 60% ± 5% RH');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));

  const [parameters, setParameters] = useState(
    DEFAULT_PARAMS.map((p) => ({ parameter: p, initialValue: '', specification: '' })),
  );

  const [checkpoints, setCheckpoints] = useState<
    Array<{ intervalTag: string; dueDate: string }>
  >([
    {
      intervalTag: 'T3',
      dueDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    },
    {
      intervalTag: 'T6',
      dueDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    },
    {
      intervalTag: 'T12',
      dueDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    },
  ]);

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddParam = () => {
    setParameters([...parameters, { parameter: '', initialValue: '', specification: '' }]);
  };

  const handleRemoveParam = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleAddCheckpoint = () => {
    setCheckpoints([...checkpoints, { intervalTag: '', dueDate: '' }]);
  };

  const handleRemoveCheckpoint = (index: number) => {
    setCheckpoints(checkpoints.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sampleId) {
      setError(t('stability.selectSample', 'Tasdiqlangan namunani tanlang'));
      return;
    }

    const validParams = parameters.filter((p) => p.parameter.trim() !== '');
    if (validParams.length === 0) {
      setError('Kamida bitta parametr talab qilinadi');
      return;
    }

    const validCheckpoints = checkpoints.filter(
      (cp) => cp.intervalTag.trim() !== '' && cp.dueDate,
    );

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
      if (onSuccess && created?.id) {
        onSuccess(created.id);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? t('common.error', 'Xatolik yuz berdi');
      setError(msg);
    }
  };

  const approvedSamples = samplesData?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {t('stability.newStudy')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Yopish')}
            className="text-slate-400 hover:text-slate-600 text-lg font-medium"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('stability.sample')} *
            </label>
            {loadingSamples ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Spinner size="sm" /> {t('common.loading', 'Yuklanmoqda...')}
              </div>
            ) : (
              <select
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                required
              >
                <option value="">-- {t('stability.selectSample')} --</option>
                {approvedSamples.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${s.substanceName} (${s.serialNumber || s.lotNumber || t('stability.noSerial')}) - ${s.type}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('stability.startedAt')}
              </label>
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('stability.storageConditions')}
              </label>
              <input
                type="text"
                value={storageConditions}
                onChange={(e) => setStorageConditions(e.target.value)}
                placeholder={t('stability.storageConditionsPlaceholder')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Parametrlar (T0 qiymatlari) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-800">
                {t('stability.parameters')}
              </label>
              <button
                type="button"
                onClick={handleAddParam}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {t('stability.addParam')}
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {parameters.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={p.parameter}
                    onChange={(e) => {
                      const updated = [...parameters];
                      updated[idx]!.parameter = e.target.value;
                      setParameters(updated);
                    }}
                    placeholder={t('stability.paramNamePlaceholder')}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={p.initialValue}
                    onChange={(e) => {
                      const updated = [...parameters];
                      updated[idx]!.initialValue = e.target.value;
                      setParameters(updated);
                    }}
                    placeholder={t('stability.initialValuePlaceholder')}
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={p.specification}
                    onChange={(e) => {
                      const updated = [...parameters];
                      updated[idx]!.specification = e.target.value;
                      setParameters(updated);
                    }}
                    placeholder={t('stability.specPlaceholder')}
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveParam(idx)}
                    aria-label={t('common.delete', 'O‘chirish')}
                    className="text-slate-400 hover:text-rose-600 text-xs px-1"
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dastlabki checkpointlar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-800">
                {t('stability.checkpoints')}
              </label>
              <button
                type="button"
                onClick={handleAddCheckpoint}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {t('stability.addCheckpoint')}
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {checkpoints.map((cp, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={cp.intervalTag}
                    onChange={(e) => {
                      const updated = [...checkpoints];
                      updated[idx]!.intervalTag = e.target.value;
                      setCheckpoints(updated);
                    }}
                    placeholder={t('stability.checkpointNamePlaceholder')}
                    className="w-32 rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={cp.dueDate}
                    onChange={(e) => {
                      const updated = [...checkpoints];
                      updated[idx]!.dueDate = e.target.value;
                      setCheckpoints(updated);
                    }}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCheckpoint(idx)}
                    aria-label={t('common.delete', 'O‘chirish')}
                    className="text-slate-400 hover:text-rose-600 text-xs px-1"
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('stability.cancel')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending && <Spinner size="sm" />}
              {t('stability.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
