import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useDeletePassportMutation } from '@/hooks/useSamples';

interface PassportDeleteModalProps {
  open: boolean;
  onClose: () => void;
  sampleId: string;
  fileName: string;
  /** D-111: tasdiqlangan namunada pasport o'chirilsa ham namuna approved qoladi — ogohlantirish. */
  approved: boolean;
}

export const PassportDeleteModal: React.FC<PassportDeleteModalProps> = ({
  open,
  onClose,
  sampleId,
  fileName,
  approved,
}) => {
  const { t } = useTranslation();
  const mutation = useDeletePassportMutation();

  const confirm = async () => {
    try {
      await mutation.mutateAsync(sampleId);
      toast.success(t('samples.passport.deleted'));
      onClose();
    } catch {
      // Xato global toast orqali ko'rsatiladi
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('samples.passport.deleteTitle')}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-slate-300"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={mutation.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {t('samples.passport.delete')}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-700">
        {t('samples.passport.deleteConfirm', { name: fileName })}
      </p>
      {approved && (
        <p className="mt-2 text-xs text-amber-700">{t('samples.passport.deleteApprovedWarning')}</p>
      )}
    </Modal>
  );
};
