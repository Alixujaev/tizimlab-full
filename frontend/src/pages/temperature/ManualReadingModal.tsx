import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { useCreateManualReadingMutation } from '@/hooks/useTemperature';
import type { SensorConfigDto } from '@/types';

interface ManualReadingModalProps {
  open: boolean;
  onClose: () => void;
  sensors: SensorConfigDto[];
  defaultSensorId?: string;
}

export function ManualReadingModal({
  open,
  onClose,
  sensors,
  defaultSensorId,
}: ManualReadingModalProps) {
  const { t } = useTranslation();
  const [sensorConfigId, setSensorConfigId] = useState<string>(
    defaultSensorId || sensors[0]?.id || '',
  );
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateManualReadingMutation();

  const activeSensors = sensors.filter((s) => s.isActive);
  const selectedSensor = sensors.find((s) => s.id === (sensorConfigId || sensors[0]?.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tempNum = parseFloat(temperature);
    if (isNaN(tempNum) || tempNum < -100 || tempNum > 100) {
      setError(t('temperature.enterTemp'));
      return;
    }

    const humNum = humidity.trim() !== '' ? parseFloat(humidity) : undefined;
    if (humNum !== undefined && (isNaN(humNum) || humNum < 0 || humNum > 100)) {
      setError(t('temperature.enterHumidity'));
      return;
    }

    const targetSensorId = sensorConfigId || activeSensors[0]?.id;
    if (!targetSensorId) {
      setError(t('temperature.selectSensor'));
      return;
    }

    try {
      await mutation.mutateAsync({
        sensorConfigId: targetSensorId,
        temperature: tempNum,
        humidity: humNum,
      });
      setTemperature('');
      setHumidity('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('temperature.manualReading')}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('temperature.cancel')}
          </button>
          <button
            type="submit"
            form="manual-reading-form"
            disabled={mutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? t('common.saving') : t('temperature.save')}
          </button>
        </div>
      }
    >
      <form id="manual-reading-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t('temperature.selectSensor')}
          </label>
          <select
            value={sensorConfigId || activeSensors[0]?.id || ''}
            onChange={(e) => setSensorConfigId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          >
            {activeSensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.locationName} ({s.sensorId})
              </option>
            ))}
          </select>
        </div>

        {selectedSensor && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              <strong className="mr-1">{t('temperature.tempRange')}:</strong>
              {selectedSensor.tempMin} &ndash; {selectedSensor.tempMax}
            </p>
            {selectedSensor.humidityMin != null && selectedSensor.humidityMax != null && (
              <p className="mt-1">
                <strong className="mr-1">{t('temperature.humidityRange')}:</strong>
                {selectedSensor.humidityMin} &ndash; {selectedSensor.humidityMax}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('temperature.temperature')}
            </label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('temperature.humidity')}
            </label>
            <input
              type="number"
              step="0.1"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
