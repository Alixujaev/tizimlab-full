import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormField, Modal, Textarea } from '@/ui';

interface ProtocolRejectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

const MIN = 5;

export function ProtocolRejectModal({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
}: ProtocolRejectModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError(t('protocols.reasonMinLength', 'Sabab kamida 5 ta belgidan iborat bo‘lishi shart'));
      return;
    }
    setError(null);
    await onConfirm(trimmed);
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('protocols.rejectModalTitle', 'Protokolni rad etish')}
      description={t(
        'protocols.rejectModalDesc',
        'Protokolni rad etish sababini kiriting. Ushbu sabab kimyogarga ko‘rsatiladi va imzo jurnalida saqlanadi.',
      )}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={!isValid}
            loading={isSubmitting}
          >
            {t('protocols.rejectConfirm', 'Rad etish')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <FormField
          label={t('protocols.rejectReasonLabel', 'Rad etish sababi (kamida 5 ta belgi)')}
          required
          error={error}
          hint={`${t('protocols.minChars', 'Kamida 5 ta belgi')} · ${trimmed.length}/${MIN}`}
        >
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t(
              'protocols.rejectReasonPlaceholder',
              'Masalan: Natijalar me’yoridan chetga chiqqan, tahlil qayta o‘tkazilsin...',
            )}
          />
        </FormField>
      </form>
    </Modal>
  );
}
