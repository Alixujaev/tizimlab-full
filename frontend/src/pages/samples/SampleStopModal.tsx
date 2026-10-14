import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useStopSampleMutation } from '@/hooks/useSamples';
import type { SampleDto } from '@/types';
import { Alert, Button, FormField, Modal, Textarea } from '@/ui';

interface SampleStopModalProps {
  open: boolean;
  onClose: () => void;
  sample: SampleDto | null;
}

const MIN_REASON = 5;

export function SampleStopModal({ open, onClose, sample }: SampleStopModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const stopMutation = useStopSampleMutation();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open || !sample) return null;

  const handleClose = () => {
    setReason('');
    setReasonError(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setReasonError(
        t(
          'samples.validation.stopReasonMinLength',
          'To‘xtatish sababi kamida 5 ta belgidan iborat bo‘lishi shart',
        ),
      );
      return;
    }
    setError(null);
    try {
      await stopMutation.mutateAsync({ id: sample.id, input: { reason: trimmed } });
      handleClose();
    } catch (err) {
      setError(toApiError(err)?.message ?? t('common.loadError', 'Xatolik yuz berdi'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('samples.stopAnalysis', 'Tahlilni to‘xtatish')}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={stopMutation.isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button type="submit" form={formId} variant="danger" loading={stopMutation.isPending}>
            {t('samples.confirmStopButton', 'Tahlilni to‘xtatish')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="warning" title={sample.substanceName}>
          {t(
            'samples.stopAnalysisWarning',
            'Tahlilni to‘xtatish uchun sabab ko‘rsatishingiz shart. Ushbu ma’lumot namuna tarixiga yoziladi.',
          )}
        </Alert>
        <FormField
          id="stop-sample-reason"
          label={t('samples.stopReason', 'To‘xtatish sababi')}
          required
          error={reasonError}
          hint={t('samples.charactersCount', { count: reason.trim().length })}
        >
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            placeholder={t(
              'samples.stopReasonPlaceholder',
              'Masalan: Reaktiv yetishmasligi yoki asbob nosozligi tufayli (kamida 5 belgi)...',
            )}
          />
        </FormField>
      </form>
    </Modal>
  );
}
