import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useReviewPassportMutation } from '@/hooks/useSamples';
import { errorMessage } from '@/lib/queryClient';

interface PassportRejectModalProps {
  open: boolean;
  onClose: () => void;
  sampleId: string;
}

/** Rad etish sababi majburiy, kamida 5 belgi (Q-17, D-85). */
export const PassportRejectModal: React.FC<PassportRejectModalProps> = ({
  open,
  onClose,
  sampleId,
}) => {
  const { t } = useTranslation();
  const mutation = useReviewPassportMutation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError(t('samples.passport.rejectReasonMin'));
      return;
    }
    try {
      await mutation.mutateAsync({ id: sampleId, input: { decision: 'reject', reason: trimmed } });
      toast.success(t('samples.passport.rejected'));
      close();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={close} title={t('samples.passport.rejectTitle')}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          {t('samples.passport.rejectReason')}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t('samples.passport.rejectReasonPlaceholder')}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="px-3 py-1.5 text-sm rounded border border-slate-300"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {t('samples.passport.reject')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
