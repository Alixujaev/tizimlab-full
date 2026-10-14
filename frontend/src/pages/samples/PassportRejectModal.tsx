import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewPassportMutation } from '@/hooks/useSamples';
import { errorMessage } from '@/lib/queryClient';
import { Button, FormField, Modal, notify, Textarea } from '@/ui';

interface PassportRejectModalProps {
  open: boolean;
  onClose: () => void;
  sampleId: string;
}

/** Rad etish sababi majburiy, kamida 5 belgi (Q-17, D-85). */
export function PassportRejectModal({ open, onClose, sampleId }: PassportRejectModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useReviewPassportMutation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError(t('samples.passport.rejectReasonMin'));
      return;
    }
    try {
      await mutation.mutateAsync({ id: sampleId, input: { decision: 'reject', reason: trimmed } });
      notify.success(t('samples.passport.rejected'));
      close();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('samples.passport.rejectTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="danger" loading={mutation.isPending}>
            {t('samples.passport.reject')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <FormField label={t('samples.passport.rejectReason')} required error={error}>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t('samples.passport.rejectReasonPlaceholder')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
