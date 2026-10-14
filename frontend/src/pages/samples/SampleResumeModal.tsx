import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useResumeSampleMutation } from '@/hooks/useSamples';
import type { SampleDto } from '@/types';
import { Alert, Button, FormField, Modal, Textarea } from '@/ui';

interface SampleResumeModalProps {
  open: boolean;
  onClose: () => void;
  sample: SampleDto | null;
}

export function SampleResumeModal({ open, onClose, sample }: SampleResumeModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const resumeMutation = useResumeSampleMutation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open || !sample) return null;

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await resumeMutation.mutateAsync({ id: sample.id, input: { reason: reason.trim() || null } });
      handleClose();
    } catch (err) {
      setError(toApiError(err)?.message ?? t('common.loadError', 'Xatolik yuz berdi'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('samples.resumeAnalysis', 'Tahlilni davom ettirish')}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={resumeMutation.isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button type="submit" form={formId} loading={resumeMutation.isPending}>
            {t('samples.confirmResumeButton', 'Davom ettirish')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="info" title={sample.substanceName}>
          {t(
            'samples.resumeAnalysisNotice',
            'Namuna holati «Jarayonda» (in_progress) holatiga qaytariladi va tahlil davom ettiriladi.',
          )}
        </Alert>
        <FormField
          id="resume-sample-reason"
          label={t('samples.resumeReasonOptional', 'Qayta boshlash izohi (ixtiyoriy)')}
        >
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              'samples.resumeReasonPlaceholder',
              'Masalan: Reaktivlar yetkazib berildi va tekshiruv davom ettirilmoqda...',
            )}
          />
        </FormField>
      </form>
    </Modal>
  );
}
