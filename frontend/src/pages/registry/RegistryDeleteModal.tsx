import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useDeleteRegistryItemMutation } from '@/hooks/useRegistry';

interface RegistryDeleteModalProps {
  sample: { id: string; substanceName: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export const RegistryDeleteModal: React.FC<RegistryDeleteModalProps> = ({
  sample,
  onClose,
  onDeleted,
}) => {
  const { t } = useTranslation();
  const mutation = useDeleteRegistryItemMutation();

  const confirm = async () => {
    if (!sample) return;
    try {
      await mutation.mutateAsync(sample.id);
      toast.success(t('registry.deleted'));
      onClose();
      onDeleted?.();
    } catch {
      // Xato global toast orqali ko'rsatiladi
    }
  };

  return (
    <Modal
      open={Boolean(sample)}
      onClose={onClose}
      title={t('registry.deleteTitle')}
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
            {t('registry.confirmDelete')}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-700">
        {t('registry.deleteConfirm', { name: sample?.substanceName ?? '' })}
      </p>
    </Modal>
  );
};
