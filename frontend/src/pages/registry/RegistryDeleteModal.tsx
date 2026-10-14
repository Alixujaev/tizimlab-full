import { useTranslation } from 'react-i18next';
import { useDeleteRegistryItemMutation } from '@/hooks/useRegistry';
import { ConfirmDialog, notify } from '@/ui';

interface RegistryDeleteModalProps {
  sample: { id: string; substanceName: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function RegistryDeleteModal({ sample, onClose, onDeleted }: RegistryDeleteModalProps) {
  const { t } = useTranslation();
  const mutation = useDeleteRegistryItemMutation();

  const confirm = async () => {
    if (!sample) return;
    try {
      await mutation.mutateAsync(sample.id);
      notify.success(t('registry.deleted'));
      onClose();
      onDeleted?.();
    } catch {
      // Xato global toast orqali ko'rsatiladi
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(sample)}
      title={t('registry.deleteTitle')}
      description={t('registry.deleteConfirm', { name: sample?.substanceName ?? '' })}
      confirmLabel={t('registry.confirmDelete')}
      cancelLabel={t('common.cancel')}
      loading={mutation.isPending}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
