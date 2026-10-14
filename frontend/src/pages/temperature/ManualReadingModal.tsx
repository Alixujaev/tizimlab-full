import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateManualReadingMutation } from '@/hooks/useTemperature';
import { errorMessage } from '@/lib/queryClient';
import type { SensorConfigDto } from '@/types';
import { Alert, Button, FormField, Input, Modal, Select } from '@/ui';

interface ManualReadingModalProps {
  open: boolean;
  onClose: () => void;
  sensors: SensorConfigDto[];
  defaultSensorId?: string;
}

interface FieldErrors {
  sensor?: string;
  temperature?: string;
  humidity?: string;
}

export function ManualReadingModal({
  open,
  onClose,
  sensors,
  defaultSensorId,
}: ManualReadingModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useCreateManualReadingMutation();
  const activeSensors = sensors.filter((s) => s.isActive);
  const [sensorConfigId, setSensorConfigId] = useState(defaultSensorId || sensors[0]?.id || '');
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const currentId = sensorConfigId || activeSensors[0]?.id || '';
  const selectedSensor = sensors.find((s) => s.id === currentId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: FieldErrors = {};
    const tempNum = parseFloat(temperature);
    if (Number.isNaN(tempNum) || tempNum < -100 || tempNum > 100)
      next.temperature = t('temperature.enterTemp');
    const humNum = humidity.trim() !== '' ? parseFloat(humidity) : undefined;
    if (humNum !== undefined && (Number.isNaN(humNum) || humNum < 0 || humNum > 100)) {
      next.humidity = t('temperature.enterHumidity');
    }
    if (!currentId) next.sensor = t('temperature.selectSensor');
    setFieldErrors(next);
    if (next.temperature || next.humidity || next.sensor) return;

    try {
      await mutation.mutateAsync({
        sensorConfigId: currentId,
        temperature: tempNum,
        humidity: humNum,
      });
      setTemperature('');
      setHumidity('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('temperature.manualReading')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('temperature.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {t('temperature.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label={t('temperature.selectSensor')} required error={fieldErrors.sensor}>
          <Select
            options={activeSensors.map((s) => ({
              value: s.id,
              label: `${s.locationName} (${s.sensorId})`,
            }))}
            value={currentId}
            onChange={setSensorConfigId}
          />
        </FormField>
        {selectedSensor && (
          <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-xs text-fg-muted">
            <p>
              <strong className="mr-1 text-fg">{t('temperature.tempRange')}:</strong>
              {selectedSensor.tempMin} – {selectedSensor.tempMax}
            </p>
            {selectedSensor.humidityMin != null && selectedSensor.humidityMax != null && (
              <p className="mt-1">
                <strong className="mr-1 text-fg">{t('temperature.humidityRange')}:</strong>
                {selectedSensor.humidityMin} – {selectedSensor.humidityMax}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('temperature.temperature')} required error={fieldErrors.temperature}>
            <Input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </FormField>
          <FormField label={t('temperature.humidity')} error={fieldErrors.humidity}>
            <Input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
