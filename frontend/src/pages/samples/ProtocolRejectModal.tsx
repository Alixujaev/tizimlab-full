import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';

interface ProtocolRejectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const ProtocolRejectModal: React.FC<ProtocolRejectModalProps> = ({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
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
      setError(t('protocols.reasonMinLength', 'Sabab kamida 5 ta belgidan iborat bo‘lishi shart'));
      return;
    }
    setError(null);
    await onConfirm(trimmed);
    close();
  };

  const trimmed = reason.trim();
  const isValid = trimmed.length >= 5;

  return (
    <Modal open={open} onClose={close} title={t('protocols.rejectModalTitle', 'Protokolni rad etish')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-slate-600">
          {t(
            'protocols.rejectModalDesc',
            'Protokolni rad etish sababini kiriting. Ushbu sabab kimyogarga ko‘rsatiladi va imzo jurnalida saqlanadi.',
          )}
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t('protocols.rejectReasonLabel', 'Rad etish sababi (kamida 5 ta belgi)')}
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t(
                'protocols.rejectReasonPlaceholder',
                'Masalan: Natijalar me’yoridan chetga chiqqan, tahlil qayta o‘tkazilsin...',
              )}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </label>

          <div className="flex justify-between items-center text-xs mt-1">
            {error ? (
              <span role="alert" className="text-rose-600">
                {error}
              </span>
            ) : (
              <span className="text-slate-400">
                {t('protocols.minChars', 'Kamida 5 ta belgi')}
              </span>
            )}
            <span className={isValid ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
              {trimmed.length}/5
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="px-4 py-1.5 text-sm font-medium rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? t('common.loading', 'Yuklanmoqda...')
              : t('protocols.rejectConfirm', 'Rad etish')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
