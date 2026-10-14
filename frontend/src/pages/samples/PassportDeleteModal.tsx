import { useTranslation } from 'react-i18next';
import { useDeletePassportMutation } from '@/hooks/useSamples';
import { ConfirmDialog, notify } from '@/ui';

interface PassportDeleteModalProps {
  open: boolean;
  onClose: () => void;
  sampleId: string;
  fileName: string;
  /** D-111: tasdiqlangan namunada pasport o'chirilsa ham namuna approved qoladi — ogohlantirish. */
  approved: boolean;
}

export function PassportDeleteModal({
  open,
  onClose,
  sampleId,
  fileName,
  approved,
}: PassportDeleteModalProps) {
  const { t } = useTranslation();
  const mutation = useDeletePassportMutation();

  const confirm = async () => {
    try {
      await mutation.mutateAsync(sampleId);
      notify.success(t('samples.passport.deleted'));
      onClose();
    } catch {
      // Xato global toast orqali ko'rsatiladi
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={t('samples.passport.deleteTitle')}
      description={t('samples.passport.deleteConfirm', { name: fileName })}
      confirmLabel={t('samples.passport.delete')}
      cancelLabel={t('common.cancel')}
      loading={mutation.isPending}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      {approved && (
        <p className="text-sm text-warning-fg">{t('samples.passport.deleteApprovedWarning')}</p>
      )}
    </ConfirmDialog>
  );
}
