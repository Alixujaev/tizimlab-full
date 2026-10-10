import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import {
  useCreateSensorMutation,
  useDeleteSensorMutation,
  useUpdateSensorMutation,
} from '@/hooks/useTemperature';
import type { SensorConfigDto } from '@/types';

interface SensorConfigModalProps {
  open: boolean;
  onClose: () => void;
  sensors: SensorConfigDto[];
}

export function SensorConfigModal({ open, onClose, sensors }: SensorConfigModalProps) {
  const { t } = useTranslation();
  const [editingSensor, setEditingSensor] = useState<SensorConfigDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form holati
  const [sensorId, setSensorId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [tempMin, setTempMin] = useState('');
  const [tempMax, setTempMax] = useState('');
  const [humidityMin, setHumidityMin] = useState('');
  const [humidityMax, setHumidityMax] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateSensorMutation();
  const updateMutation = useUpdateSensorMutation();
  const deleteMutation = useDeleteSensorMutation();

  const handleStartCreate = () => {
    setEditingSensor(null);
    setSensorId('');
    setLocationName('');
    setTempMin('15');
    setTempMax('25');
    setHumidityMin('');
    setHumidityMax('');
    setApiKey('');
    setIsActive(true);
    setError(null);
    setIsCreating(true);
  };

  const handleStartEdit = (sensor: SensorConfigDto) => {
    setEditingSensor(sensor);
    setSensorId(sensor.sensorId);
    setLocationName(sensor.locationName);
    setTempMin(String(sensor.tempMin));
    setTempMax(String(sensor.tempMax));
    setHumidityMin(sensor.humidityMin != null ? String(sensor.humidityMin) : '');
    setHumidityMax(sensor.humidityMax != null ? String(sensor.humidityMax) : '');
    setApiKey(sensor.apiKey || '');
    setIsActive(sensor.isActive);
    setError(null);
    setIsCreating(false);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingSensor(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tMin = parseFloat(tempMin);
    const tMax = parseFloat(tempMax);
    if (isNaN(tMin) || isNaN(tMax) || tMin >= tMax) {
      setError(t('temperature.tempRange'));
      return;
    }

    const hMin = humidityMin.trim() !== '' ? parseFloat(humidityMin) : undefined;
    const hMax = humidityMax.trim() !== '' ? parseFloat(humidityMax) : undefined;
    if (hMin !== undefined && hMax !== undefined && hMin >= hMax) {
      setError(t('temperature.humidityRange'));
      return;
    }

    try {
      if (editingSensor) {
        await updateMutation.mutateAsync({
          id: editingSensor.id,
          input: {
            sensorId: sensorId.trim(),
            locationName: locationName.trim(),
            tempMin: tMin,
            tempMax: tMax,
            humidityMin: hMin ?? null,
            humidityMax: hMax ?? null,
            apiKey: apiKey.trim() || null,
            isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          sensorId: sensorId.trim(),
          locationName: locationName.trim(),
          tempMin: tMin,
          tempMax: tMax,
          humidityMin: hMin ?? null,
          humidityMax: hMax ?? null,
          apiKey: apiKey.trim() || null,
          isActive,
        });
      }
      handleCancelForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      if (editingSensor?.id === id) handleCancelForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    }
  };

  const isFormOpen = isCreating || editingSensor != null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('temperature.sensorSettings')}
      footer={
        <div className="flex justify-between w-full">
          <div>
            {!isFormOpen && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t('temperature.newSensor')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {isFormOpen ? (
          <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-800">
              {editingSensor
                ? t('temperature.editSensor')
                : t('temperature.newSensor')}
            </h4>

            {error && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.sensorId')}
                </label>
                <input
                  type="text"
                  value={sensorId}
                  onChange={(e) => setSensorId(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.locationName')}
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.tempMin')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.tempMax')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.humidityMin')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={humidityMin}
                  onChange={(e) => setHumidityMin(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.humidityMax')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={humidityMax}
                  onChange={(e) => setHumidityMax(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('temperature.apiKey')}
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {t('temperature.isActive')}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {t('temperature.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('temperature.save')}
              </button>
            </div>
          </form>
        ) : null}

        {/* Sensorlar ro'yxati */}
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
          {sensors.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {t('temperature.noSensors')}
            </div>
          ) : (
            sensors.map((sensor) => (
              <div
                key={sensor.id}
                className="flex items-center justify-between p-3 hover:bg-slate-50 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <span>{sensor.locationName}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {sensor.sensorId}
                    </span>
                    {!sensor.isActive && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                        {t('temperature.inactive')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    <span>{sensor.tempMin} &ndash; {sensor.tempMax} {t('temperature.tempUnit')}</span>
                    {sensor.humidityMin != null && sensor.humidityMax != null && (
                      <span className="ml-2">({sensor.humidityMin} &ndash; {sensor.humidityMax} {t('temperature.humidityUnit')})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(sensor)}
                    className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    {t('temperature.editSensor')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sensor.id)}
                    className="rounded px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    {t('temperature.deleteSensor')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
