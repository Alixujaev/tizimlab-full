import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useUsersQuery } from '@/hooks/useAdminUsers';
import { useAssignSampleMutation } from '@/hooks/useSamples';
import type { SampleDto } from '@/types';
import { Alert, Button, FormField, Modal, Select, Skeleton } from '@/ui';

interface SampleAssignModalProps {
  open: boolean;
  onClose: () => void;
  sample: SampleDto | null;
}

export function SampleAssignModal({ open, onClose, sample }: SampleAssignModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const assignMutation = useAssignSampleMutation();
  // Kimyogarlar ro'yxati faqat modal ochilganda so'raladi (403 qoidasi: faqat lab_head ochadi)
  const { data: usersData, isLoading: isUsersLoading } = useUsersQuery(
    { role: 'chemist', isActive: true, limit: 100 },
    { enabled: open && Boolean(sample) },
  );
  const chemists = usersData?.data ?? [];
  const [selectedChemistId, setSelectedChemistId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open || !sample) return null;

  const isReagentOrStandard = sample.type === 'reagent' || sample.type === 'standard_substance';
  const isReassignment = Boolean(sample.assignedTo);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedChemistId) {
      setError(t('samples.validation.chemistRequired', 'Kimyogarni tanlash shart'));
      return;
    }
    setError(null);
    try {
      await assignMutation.mutateAsync({ id: sample.id, input: { chemistId: selectedChemistId } });
      setSelectedChemistId('');
      onClose();
    } catch (err) {
      setError(toApiError(err)?.message ?? t('common.loadError', 'Xatolik yuz berdi'));
    }
  };

  const title = isReassignment
    ? t('samples.reassignChemist', 'Namuna tahlilini qayta biriktirish')
    : t('samples.assignChemist', 'Kimyogarga biriktirish');

  if (isReagentOrStandard) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        footer={
          <Button variant="secondary" onClick={onClose}>
            {t('common.close', 'Yopish')}
          </Button>
        }
      >
        <Alert tone="warning">
          {t(
            'samples.reagentAssignmentNotAllowed',
            'Reaktiv va standart moddalar kimyogarga biriktirilmaydi. Ular bevosita pasport orqali tasdiqlanadi.',
          )}
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={assignMutation.isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={assignMutation.isPending}
            disabled={!selectedChemistId || chemists.length === 0}
          >
            {t('samples.assignButton', 'Biriktirish')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm">
          <p className="font-semibold text-fg">{sample.substanceName}</p>
          {sample.lotNumber && (
            <p className="text-xs text-fg-muted">
              {t('samples.lotNumber', 'Lot')}: {sample.lotNumber}
            </p>
          )}
          {sample.serialNumber && (
            <p className="text-xs text-fg-muted">
              {t('samples.serialNumber', 'Seriya')}: {sample.serialNumber}
            </p>
          )}
        </div>

        <FormField
          id="assign-chemist-select"
          label={t('samples.selectChemist', 'Kimyogarni tanlang')}
          required
        >
          {isUsersLoading ? (
            <div role="status" aria-busy="true">
              <span className="sr-only">{t('common.loading', 'Yuklanmoqda...')}</span>
              <Skeleton variant="rect" className="h-9 w-full" />
            </div>
          ) : chemists.length === 0 ? (
            <Alert tone="warning">
              {t('samples.noActiveChemists', 'Faol kimyogarlar topilmadi.')}
            </Alert>
          ) : (
            <Select
              options={chemists.map((ch) => ({
                value: ch.id,
                label: `${ch.fullName} (${ch.email})`,
              }))}
              value={selectedChemistId}
              placeholder={t('samples.selectChemistPlaceholder', 'Kimyogarni tanlang...')}
              onChange={(v) => {
                setSelectedChemistId(v);
                if (error) setError(null);
              }}
            />
          )}
        </FormField>

        <p className="text-xs text-fg-muted">
          {t(
            'samples.assignNotice',
            'Biriktirilgandan so‘ng avtomatik protokol yaratiladi va kimyogarga xabarnoma yuboriladi.',
          )}
        </p>
      </form>
    </Modal>
  );
}
