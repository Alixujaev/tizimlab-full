import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { useCreateCheckpointMutation } from '@/hooks/useStability';

interface CreateCheckpointModalProps {
  studyId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CreateCheckpointModal: React.FC<CreateCheckpointModalProps> = ({
  studyId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const mutation = useCreateCheckpointMutation(studyId);

  const [intervalTag, setIntervalTag] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!intervalTag.trim()) {
      setError(t('stability.checkpointNameRequired', 'Checkpoint nomi kiritilishi shart'));
      return;
    }
    if (!dueDate) {
      setError(t('stability.dueDateRequired', 'Sana kiritilishi shart'));
      return;
    }

    try {
      await mutation.mutateAsync({
        intervalTag: intervalTag.trim(),
        dueDate,
        notes: notes.trim() || null,
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
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {t('stability.addCheckpoint')}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('stability.checkpointName')} *
            </label>
            <input
              type="text"
              value={intervalTag}
              onChange={(e) => setIntervalTag(e.target.value)}
              placeholder={t('stability.checkpointNamePlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('stability.dueDate')} *
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('stability.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('stability.notesPlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
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
