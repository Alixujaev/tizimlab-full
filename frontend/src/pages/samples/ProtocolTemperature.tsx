import { useTranslation } from 'react-i18next';
import { useSensorsQuery } from '@/hooks/useTemperature';
import { formatDateTime } from '@/lib/date';
import type { ProtocolDto, TemperatureSuggestionDto } from '@/types';
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

/**
 * P18 (D-188): yuborishdan oldin harorat taklifi — tanlangan xona va tahlil sanasi bo'yicha.
 * Yuborishda aynan shu xona va sana ketadi (server snapshot mantiqi bir xil).
 */
export function ProtocolTemperatureSuggestion({
  roomId,
  suggestion,
  loading,
}: {
  /** Ko'rsatilayotgan (samarali) xona; bo'sh — tanlanmagan. */
  roomId: string;
  suggestion: TemperatureSuggestionDto | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (!roomId) {
    return (
      <Alert tone="warning" title={t('protocols.suggestion.title')}>
        {t('protocols.suggestion.noRoom')}
      </Alert>
    );
  }
  if (loading) {
    return <p className="text-xs text-fg-muted">{t('protocols.suggestion.loading')}</p>;
  }
  if (!suggestion) return null;
  if (suggestion.status === 'no_room') {
    return (
      <Alert tone="warning" title={t('protocols.suggestion.title')}>
        {t('protocols.suggestion.noRoom')}
      </Alert>
    );
  }
  if (suggestion.status === 'no_reading' || !suggestion.reading) {
    return (
      <Alert tone="warning" title={t('protocols.suggestion.title')}>
        {t('protocols.suggestion.noReading')}
      </Alert>
    );
  }
  const r = suggestion.reading;
  return (
    <Alert tone={suggestion.outOfRange ? 'warning' : 'info'} title={t('protocols.suggestion.title')}>
      {t('protocols.temperature.value', {
        temp: r.temperature,
        humidity: r.humidity !== null ? `, ${r.humidity}%` : '',
        room: r.locationName ?? suggestion.locationName ?? '',
        at: formatDateTime(r.recordedAt),
      })}
      {suggestion.limits && (
        <span className="block text-xs">
          {t('protocols.suggestion.limits', {
            min: suggestion.limits.tempMin,
            max: suggestion.limits.tempMax,
          })}
        </span>
      )}
      {suggestion.outOfRange && (
        <span className="block text-xs font-medium">{t('protocols.suggestion.outOfRange')}</span>
      )}
    </Alert>
  );
}
