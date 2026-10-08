import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useUsersQuery } from '@/hooks/useAdminUsers';
import { useAssignSampleMutation } from '@/hooks/useSamples';
import type { SampleDto } from '@/types';

interface SampleAssignModalProps {
  open: boolean;
  onClose: () => void;
  sample: SampleDto | null;
}

export const SampleAssignModal: React.FC<SampleAssignModalProps> = ({
  open,
  onClose,
  sample,
}) => {
  const { t } = useTranslation();
  const assignMutation = useAssignSampleMutation();
  const { data: usersData, isLoading: isUsersLoading } = useUsersQuery({
    role: 'chemist',
    isActive: true,
    limit: 100,
  });

  const chemists = usersData?.data ?? [];
  const [selectedChemistId, setSelectedChemistId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!open || !sample) return null;

  const isReagentOrStandard =
    sample.type === 'reagent' || sample.type === 'standard_substance';

  const isReassignment = Boolean(sample.assignedTo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChemistId) {
      setError(t('samples.validation.chemistRequired', 'Kimyogarni tanlash shart'));
      return;
    }
    setError(null);

    try {
      await assignMutation.mutateAsync({
        id: sample.id,
        input: { chemistId: selectedChemistId },
      });
      setSelectedChemistId('');
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
      title={
        isReassignment
          ? t('samples.reassignChemist', 'Namuna tahlilini qayta biriktirish')
          : t('samples.assignChemist', 'Kimyogarga biriktirish')
      }
    >
      {isReagentOrStandard ? (
        <div className="space-y-4">
          <div className="p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
            {t(
              'samples.reagentAssignmentNotAllowed',
              'Reaktiv va standart moddalar kimyogarga biriktirilmaydi. Ular bevosita pasport orqali tasdiqlanadi.',
            )}
          </div>
          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              {t('common.close', 'Yopish')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
            <p className="font-semibold text-slate-800">
              {sample.substanceName}
            </p>
            {sample.lotNumber && (
              <p className="text-slate-500">
                {t('samples.lotNumber', 'Lot')}: {sample.lotNumber}
              </p>
            )}
            {sample.serialNumber && (
              <p className="text-slate-500">
                {t('samples.serialNumber', 'Seriya')}: {sample.serialNumber}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="assign-chemist-select"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t('samples.selectChemist', 'Kimyogarni tanlang')}{' '}
              <span className="text-red-500">*</span>
            </label>
            {isUsersLoading ? (
              <div className="py-2 flex items-center gap-2 text-xs text-slate-500">
                <Spinner size="sm" />
                {t('common.loading', 'Yuklanmoqda...')}
              </div>
            ) : chemists.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                {t('samples.noActiveChemists', 'Faol kimyogarlar topilmadi.')}
              </p>
            ) : (
              <select
                id="assign-chemist-select"
                value={selectedChemistId}
                onChange={(e) => {
                  setSelectedChemistId(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {t('samples.selectChemistPlaceholder', 'Kimyogarni tanlang...')}
                </option>
                {chemists.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.fullName} ({ch.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {t(
              'samples.assignNotice',
              'Biriktirilgandan so‘ng avtomatik protokol yaratiladi va kimyogarga xabarnoma yuboriladi.',
            )}
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={assignMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              {t('common.cancel', 'Bekor qilish')}
            </button>
            <button
              type="submit"
              disabled={
                assignMutation.isPending || !selectedChemistId || chemists.length === 0
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {assignMutation.isPending && <Spinner size="sm" />}
              {t('samples.assignButton', 'Biriktirish')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
