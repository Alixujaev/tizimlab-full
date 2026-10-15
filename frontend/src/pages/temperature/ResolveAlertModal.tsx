import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResolveAlertMutation } from '@/hooks/useTemperature';
import { formatDateTime } from '@/lib/date';
import { errorMessage } from '@/lib/queryClient';
import type { TemperatureAlertDto } from '@/types';
import { Alert, Button, FormField, Modal, Textarea } from '@/ui';
import { alertTypeLabel } from './alertType';

interface ResolveAlertModalProps {
  open: boolean;
  onClose: () => void;
  alert: TemperatureAlertDto | null;
}

export function ResolveAlertModal({ open, onClose, alert }: ResolveAlertModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useResolveAlertMutation();

  if (!alert) return null;

  const handleResolve = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        id: alert.id,
        input: { resolutionNote: resolutionNote.trim() || null },
      });
      setResolutionNote('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('temperature.resolve')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('temperature.cancel')}
          </Button>
          <Button type="submit" form={formId} leftIcon="check" loading={mutation.isPending}>
            {t('temperature.resolve')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleResolve} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="warning" title={`${alert.locationName} (${alert.sensorId})`}>
          <p>
            {t('temperature.temperature')}: {alert.temperature} {t('temperature.tempUnit')} ·{' '}
            {alertTypeLabel(t, alert.alertType)}
          </p>
          <p className="mt-1 text-xs">{formatDateTime(alert.createdAt)}</p>
        </Alert>
        <FormField label={t('temperature.resolutionNote')}>
          <Textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
