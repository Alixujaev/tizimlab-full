import { useTranslation } from 'react-i18next';
import { useSensorsQuery } from '@/hooks/useTemperature';
import { formatDateTime } from '@/lib/date';
import type { ProtocolDto } from '@/types';
import { Alert, FormField, Select } from '@/ui';

/**
 * D-173: protokolga bog'langan xona harorati (snapshot) yoki aniq ogohlantirish.
 * Qiymat yuborish paytida olingan nusxa — harorat jurnali keyin o'zgarsa ham shu ko'rsatiladi.
 */
export function ProtocolTemperatureInfo({
  protocol,
}: {
  protocol: Pick<ProtocolDto, 'status' | 'temperatureSnapshot' | 'temperatureWarning'>;
}) {
  const { t } = useTranslation();
  if (protocol.status === 'draft') return null;
  const snap = protocol.temperatureSnapshot;
  if (snap) {
    return (
      <Alert
        tone={snap.alertTriggered ? 'warning' : 'info'}
        title={t('protocols.temperature.title')}
      >
        {t('protocols.temperature.value', {
          temp: snap.temperature,
          humidity: snap.humidity !== null ? `, ${snap.humidity}%` : '',
          room: snap.locationName,
          at: formatDateTime(snap.recordedAt),
        })}
        {snap.alertTriggered && (
          <span className="block text-xs">{t('protocols.temperature.outOfRange')}</span>
        )}
      </Alert>
    );
  }
  if (protocol.temperatureWarning) {
    return (
      <Alert tone="warning" title={t('protocols.temperature.title')}>
        {t(`protocols.temperature.warning.${protocol.temperatureWarning}`)}
      </Alert>
    );
  }
  return null;
}

/** Yuborishdan oldin xona tanlovi (kimyogar uchun). Bo'sh — "tanlanmagan" (no_room ogohlantirishi bilan). */
export function ProtocolRoomSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { data: sensors = [], isLoading } = useSensorsQuery(true);
  return (
    <FormField
      id="protocol-room"
      label={t('protocols.temperature.room')}
      hint={t('protocols.temperature.roomHint')}
      className="w-full sm:w-72"
    >
      <Select
        disabled={isLoading}
        options={[
          { value: '', label: t('protocols.temperature.noRoom') },
          ...sensors
            .filter((s) => s.isActive)
            .map((s) => ({ value: s.id, label: `${s.locationName} (${s.sensorId})` })),
        ]}
        value={value}
        onChange={onChange}
      />
    </FormField>
  );
}
