import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCreateSensorMutation,
  useDeleteSensorMutation,
  useUpdateSensorMutation,
} from '@/hooks/useTemperature';
import { errorMessage } from '@/lib/queryClient';
import type { SensorConfigDto } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Modal,
} from '@/ui';

interface SensorConfigModalProps {
  open: boolean;
  onClose: () => void;
  sensors: SensorConfigDto[];
}

export function SensorConfigModal({ open, onClose, sensors }: SensorConfigModalProps) {
  const { t } = useTranslation();
  const [editingSensor, setEditingSensor] = useState<SensorConfigDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sensorToDelete, setSensorToDelete] = useState<SensorConfigDto | null>(null);

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

  const fill = (sensor: SensorConfigDto | null) => {
    setSensorId(sensor?.sensorId ?? '');
    setLocationName(sensor?.locationName ?? '');
    setTempMin(sensor ? String(sensor.tempMin) : '15');
    setTempMax(sensor ? String(sensor.tempMax) : '25');
    setHumidityMin(sensor?.humidityMin != null ? String(sensor.humidityMin) : '');
    setHumidityMax(sensor?.humidityMax != null ? String(sensor.humidityMax) : '');
    setApiKey(sensor?.apiKey || '');
    setIsActive(sensor?.isActive ?? true);
    setError(null);
  };

  const startCreate = () => {
    setEditingSensor(null);
    fill(null);
    setIsCreating(true);
  };

  const startEdit = (sensor: SensorConfigDto) => {
    setEditingSensor(sensor);
    fill(sensor);
    setIsCreating(false);
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingSensor(null);
    setError(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const tMin = parseFloat(tempMin);
    const tMax = parseFloat(tempMax);
    if (Number.isNaN(tMin) || Number.isNaN(tMax) || tMin >= tMax) {
      setError(t('temperature.tempRange'));
      return;
    }
    const hMin = humidityMin.trim() !== '' ? parseFloat(humidityMin) : undefined;
    const hMax = humidityMax.trim() !== '' ? parseFloat(humidityMax) : undefined;
    if (hMin !== undefined && hMax !== undefined && hMin >= hMax) {
      setError(t('temperature.humidityRange'));
      return;
    }
    const input = {
      sensorId: sensorId.trim(),
      locationName: locationName.trim(),
      tempMin: tMin,
      tempMax: tMax,
      humidityMin: hMin ?? null,
      humidityMax: hMax ?? null,
      apiKey: apiKey.trim() || null,
      isActive,
    };
    try {
      if (editingSensor) await updateMutation.mutateAsync({ id: editingSensor.id, input });
      else await createMutation.mutateAsync(input);
      cancelForm();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!sensorToDelete) return;
    try {
      await deleteMutation.mutateAsync(sensorToDelete.id);
      if (editingSensor?.id === sensorToDelete.id) cancelForm();
      setSensorToDelete(null);
    } catch (err) {
      setError(errorMessage(err));
      setSensorToDelete(null);
    }
  };

  const isFormOpen = isCreating || editingSensor != null;
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('temperature.sensorSettings')}
      footer={
        <>
          {!isFormOpen && (
            <Button leftIcon="plus" onClick={startCreate} className="mr-auto">
              {t('temperature.newSensor')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!isFormOpen && error && <Alert tone="danger">{error}</Alert>}
        {isFormOpen && (
          <form
            onSubmit={handleSave}
            noValidate
            className="flex flex-col gap-4 rounded-lg border border-line bg-surface-muted p-4"
          >
            <h3 className="text-sm font-semibold text-fg">
              {editingSensor ? t('temperature.editSensor') : t('temperature.newSensor')}
            </h3>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={t('temperature.sensorId')} required>
                <Input size="sm" value={sensorId} onChange={(e) => setSensorId(e.target.value)} />
              </FormField>
              <FormField label={t('temperature.locationName')} required>
                <Input
                  size="sm"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </FormField>
              <FormField label={t('temperature.tempMin')} required>
                <Input
                  size="sm"
                  type="number"
                  step="0.1"
                  value={tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                />
              </FormField>
              <FormField label={t('temperature.tempMax')} required>
                <Input
                  size="sm"
                  type="number"
                  step="0.1"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                />
              </FormField>
              <FormField label={t('temperature.humidityMin')}>
                <Input
                  size="sm"
                  type="number"
                  step="0.1"
                  value={humidityMin}
                  onChange={(e) => setHumidityMin(e.target.value)}
                />
              </FormField>
              <FormField label={t('temperature.humidityMax')}>
                <Input
                  size="sm"
                  type="number"
                  step="0.1"
                  value={humidityMax}
                  onChange={(e) => setHumidityMax(e.target.value)}
                />
              </FormField>
              <FormField label={t('temperature.apiKey')}>
                <Input
                  size="sm"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                />
              </FormField>
              <div className="flex items-end pb-1">
                <Checkbox
                  label={t('temperature.isActive')}
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelForm}>
                {t('temperature.cancel')}
              </Button>
              <Button type="submit" size="sm" loading={saving}>
                {t('temperature.save')}
              </Button>
            </div>
          </form>
        )}

        {sensors.length === 0 ? (
          <EmptyState size="sm" icon="thermometer" title={t('temperature.noSensors')} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {sensors.map((sensor) => (
              <li
                key={sensor.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {sensor.locationName}
                    <Badge size="sm" className="font-mono">
                      {sensor.sensorId}
                    </Badge>
                    {!sensor.isActive && <Badge size="sm">{t('temperature.inactive')}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {sensor.tempMin} – {sensor.tempMax} {t('temperature.tempUnit')}
                    {sensor.humidityMin != null && sensor.humidityMax != null && (
                      <span className="ml-2">
                        ({sensor.humidityMin} – {sensor.humidityMax} {t('temperature.humidityUnit')}
                        )
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(sensor)}>
                    {t('temperature.editSensor')}
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => setSensorToDelete(sensor)}
                  >
                    {t('temperature.deleteSensor')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!sensorToDelete}
        title={t('temperature.deleteSensor')}
        description={
          sensorToDelete ? `${sensorToDelete.locationName} (${sensorToDelete.sensorId})` : undefined
        }
        confirmLabel={t('temperature.deleteSensor')}
        cancelLabel={t('temperature.cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setSensorToDelete(null)}
      />
    </Modal>
  );
}
