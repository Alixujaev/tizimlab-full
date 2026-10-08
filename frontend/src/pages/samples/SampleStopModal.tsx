import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useStopSampleMutation } from '@/hooks/useSamples';
import type { SampleDto } from '@/types';

interface SampleStopModalProps {
  open: boolean;
  onClose: () => void;
  sample: SampleDto | null;
}

export const SampleStopModal: React.FC<SampleStopModalProps> = ({
  open,
  onClose,
  sample,
}) => {
  const { t } = useTranslation();
  const stopMutation = useStopSampleMutation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open || !sample) return null;

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError(
        t(
          'samples.validation.stopReasonMinLength',
          'To‘xtatish sababi kamida 5 ta belgidan iborat bo‘lishi shart',
        ),
      );
      return;
    }
    setError(null);

    try {
      await stopMutation.mutateAsync({
        id: sample.id,
        input: { reason: trimmed },
      });
      handleClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setError(apiErr?.message ?? t('common.loadError', 'Xatolik yuz berdi'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('samples.stopAnalysis', 'Tahlilni to‘xtatish')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <p className="font-semibold">{sample.substanceName}</p>
          <p className="mt-1">
            {t(
              'samples.stopAnalysisWarning',
              'Tahlilni to‘xtatish uchun sabab ko‘rsatishingiz shart. Ushbu ma’lumot namuna tarixiga yoziladi.',
            )}
          </p>
        </div>

        <div>
          <label
            htmlFor="stop-sample-reason"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {t('samples.stopReason', 'To‘xtatish sababi')}{' '}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            id="stop-sample-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t(
              'samples.stopReasonPlaceholder',
              'Masalan: Reaktiv yetishmasligi yoki asbob nosozligi tufayli (kamida 5 belgi)...',
            )}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t('samples.charactersCount', { count: reason.trim().length })}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={stopMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={stopMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700 disabled:opacity-50"
          >
            {stopMutation.isPending && <Spinner size="sm" />}
            {t('samples.confirmStopButton', 'Tahlilni to‘xtatish')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
