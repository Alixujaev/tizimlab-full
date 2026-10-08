import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useDeleteSubstanceMutation } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import type { SubstanceDto } from '@/types';

interface SubstanceDeleteModalProps {
  open: boolean;
  onClose: () => void;
  substance: SubstanceDto | null;
}

export function SubstanceDeleteModal({
  open,
  onClose,
  substance,
}: SubstanceDeleteModalProps) {
  const { t, i18n } = useTranslation();
  const deleteMutation = useDeleteSubstanceMutation();
  const [error, setError] = useState<string | null>(null);

  if (!open || !substance) return null;

  const substanceName = getSubstanceName(substance, i18n.language);

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync(substance.id);
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setError(apiErr?.message ?? t('common.loadError', 'Xatolik yuz berdi'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('substances.deleteTitle', "Moddani o'chirish")}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <p className="text-sm text-slate-600">
          {t(
            'substances.deleteConfirmation',
            "Haqiqatan ham «{{name}}» moddasini o'chirmoqchimisiz? Ushbu amal ortga qaytarilmaydi.",
            { name: substanceName },
          )}
        </p>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          >
            {deleteMutation.isPending && <Spinner size="sm" />}
            {t('common.delete', "O'chirish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
