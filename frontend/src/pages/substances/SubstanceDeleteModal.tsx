import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useDeleteSubstanceMutation } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import type { SubstanceDto } from '@/types';
import { Alert, ConfirmDialog } from '@/ui';

interface SubstanceDeleteModalProps {
  open: boolean;
  onClose: () => void;
  substance: SubstanceDto | null;
}

export function SubstanceDeleteModal({ open, onClose, substance }: SubstanceDeleteModalProps) {
  const { t, i18n } = useTranslation();
  const deleteMutation = useDeleteSubstanceMutation();
  const [error, setError] = useState<string | null>(null);

  if (!open || !substance) return null;

  const close = () => {
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync(substance.id);
      close();
    } catch (err) {
      setError(toApiError(err)?.message ?? t('common.loadError', 'Xatolik yuz berdi'));
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={t('substances.deleteTitle', "Moddani o'chirish")}
      description={t(
        'substances.deleteConfirmation',
        "Haqiqatan ham «{{name}}» moddasini o'chirmoqchimisiz? Ushbu amal ortga qaytarilmaydi.",
        { name: getSubstanceName(substance, i18n.language) },
      )}
      confirmLabel={t('common.delete', "O'chirish")}
      cancelLabel={t('common.cancel', 'Bekor qilish')}
      loading={deleteMutation.isPending}
      onConfirm={() => void handleDelete()}
      onCancel={close}
    >
      {error ? <Alert tone="danger">{error}</Alert> : undefined}
    </ConfirmDialog>
  );
}
