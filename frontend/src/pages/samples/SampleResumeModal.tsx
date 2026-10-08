import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useResumeSampleMutation } from '@/hooks/useSamples';
import type { SampleDto } from '@/types';

interface SampleResumeModalProps {
  open: boolean;
  onClose: () => void;
  sample: SampleDto | null;
}

export const SampleResumeModal: React.FC<SampleResumeModalProps> = ({
  open,
  onClose,
  sample,
}) => {
  const { t } = useTranslation();
  const resumeMutation = useResumeSampleMutation();
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
    setError(null);

    try {
      await resumeMutation.mutateAsync({
        id: sample.id,
        input: { reason: reason.trim() || null },
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
      title={t('samples.resumeAnalysis', 'Tahlilni davom ettirish')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <p className="font-semibold">{sample.substanceName}</p>
          <p className="mt-1">
            {t(
              'samples.resumeAnalysisNotice',
              'Namuna holati «Jarayonda» (in_progress) holatiga qaytariladi va tahlil davom ettiriladi.',
            )}
          </p>
        </div>

        <div>
          <label
            htmlFor="resume-sample-reason"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {t('samples.resumeReasonOptional', 'Qayta boshlash izohi (ixtiyoriy)')}
          </label>
          <textarea
            id="resume-sample-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              'samples.resumeReasonPlaceholder',
              'Masalan: Reaktivlar yetkazib berildi va tekshiruv davom ettirilmoqda...',
            )}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={resumeMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={resumeMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {resumeMutation.isPending && <Spinner size="sm" />}
            {t('samples.confirmResumeButton', 'Davom ettirish')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
