import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { useRecordResultsMutation } from '@/hooks/useStability';
import type { StabilityCheckpointDto, StabilityResultStatus } from '@/types';

interface RecordResultsModalProps {
  studyId: string;
  checkpoint: StabilityCheckpointDto;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordResultsModal: React.FC<RecordResultsModalProps> = ({
  studyId,
  checkpoint,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const mutation = useRecordResultsMutation(studyId);

  const initialResults = (checkpoint.results ?? []).map((r) => ({
    id: r.id,
    parameter: r.parameter,
    initialValue: r.initialValue,
    currentValue: r.currentValue ?? '',
    specification: r.specification ?? '',
    resultStatus: r.resultStatus ?? ('pass' as StabilityResultStatus),
  }));

  const [results, setResults] = useState(initialResults);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdate = (
    index: number,
    field: 'currentValue' | 'specification' | 'resultStatus',
    value: string,
  ) => {
    const updated = [...results];
    updated[index] = { ...updated[index]!, [field]: value };
    setResults(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that at least one result has current value
    const hasAny = results.some((r) => r.currentValue.trim() !== '');
    if (!hasAny) {
      setError(t('stability.currentValueRequired', 'Kamida bitta parametr qiymatini kiriting'));
      return;
    }

    try {
      await mutation.mutateAsync({
        checkpointId: checkpoint.id,
        input: {
          results: results
            .filter((r) => r.currentValue.trim() !== '')
            .map((r) => ({
              id: r.id,
              parameter: r.parameter,
              currentValue: r.currentValue,
              specification: r.specification || null,
              resultStatus: r.resultStatus,
            })),
        },
      });
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? t('common.error', 'Xatolik yuz berdi');
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {t('stability.recordResults')} — {checkpoint.intervalTag}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('stability.dueDate')}: {checkpoint.dueDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Yopish')}
            className="text-slate-400 hover:text-slate-600 text-lg font-medium"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border border-slate-200 rounded-lg">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 border-b border-slate-200">{t('stability.parameter')}</th>
                  <th className="px-3 py-2 border-b border-slate-200">{t('stability.initialValue')}</th>
                  <th className="px-3 py-2 border-b border-slate-200">{t('stability.currentValue')} *</th>
                  <th className="px-3 py-2 border-b border-slate-200">{t('stability.specification')}</th>
                  <th className="px-3 py-2 border-b border-slate-200">{t('stability.resultStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r, idx) => (
                  <tr key={r.parameter} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-900">{r.parameter}</td>
                    <td className="px-3 py-2 text-slate-500">{r.initialValue ?? '—'}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.currentValue}
                        onChange={(e) => handleUpdate(idx, 'currentValue', e.target.value)}
                        placeholder={t('stability.resultPlaceholder')}
                        className="w-full rounded border border-slate-300 px-2.5 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.specification}
                        onChange={(e) => handleUpdate(idx, 'specification', e.target.value)}
                        placeholder={t('stability.specPlaceholder')}
                        className="w-full rounded border border-slate-300 px-2.5 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.resultStatus}
                        onChange={(e) => handleUpdate(idx, 'resultStatus', e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="pass">{t('stability.pass')}</option>
                        <option value="warning">{t('stability.warning')}</option>
                        <option value="fail">{t('stability.fail')}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
