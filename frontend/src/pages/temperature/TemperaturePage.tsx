import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAlertsQuery,
  useReadingsQuery,
  useSensorsQuery,
  useTemperatureStatusQuery,
} from '@/hooks/useTemperature';
import { useAuthStore } from '@/store/authStore';
import type { TemperatureAlertDto, TemperatureReadingDto } from '@/types';
import {
  Badge,
  Button,
  Checkbox,
  cx,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  Pressable,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
} from '@/ui';
import { alertTypeLabel } from './alertType';
import { ManualReadingModal } from './ManualReadingModal';
import { ResolveAlertModal } from './ResolveAlertModal';
import { SensorConfigModal } from './SensorConfigModal';
import { TemperatureChart } from './TemperatureChart';

const PAGE_SIZE = 20;

function SensorLabel({ name, id }: { name?: string | null; id?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-fg">{name || '—'}</div>
      {id && <div className="font-mono text-xs text-fg-subtle">{id}</div>}
    </div>
  );
}

export function TemperaturePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  // RBAC: faqat lab_head va admin o'qish kiritadi, sensorni boshqaradi va alertni yopadi
  const canWrite = user?.role === 'admin' || user?.role === 'lab_head';

  const [activeTab, setActiveTab] = useState<'overview' | 'alerts'>('overview');
  const [selectedSensorId, setSelectedSensorId] = useState('');
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [sensorModalOpen, setSensorModalOpen] = useState(false);
  const [alertToResolve, setAlertToResolve] = useState<TemperatureAlertDto | null>(null);
  const [readingsPage, setReadingsPage] = useState(1);
  const [readingsAlertOnly, setReadingsAlertOnly] = useState(false);
  const [alertsPage, setAlertsPage] = useState(1);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);

  const { data: statusList, isLoading: isStatusLoading } = useTemperatureStatusQuery();
  const { data: sensorsList } = useSensorsQuery();
  const readingsQuery = useReadingsQuery({
    page: readingsPage,
    limit: PAGE_SIZE,
    sensorConfigId: selectedSensorId || undefined,
    alertOnly: readingsAlertOnly || undefined,
  });
  const alertsQuery = useAlertsQuery({
    page: alertsPage,
    limit: PAGE_SIZE,
    sensorConfigId: selectedSensorId || undefined,
    unresolvedOnly: unresolvedOnly || undefined,
  });

  const sensors = sensorsList ?? [];
  const selectedSensor = sensors.find((s) => s.id === selectedSensorId) ?? null;
  const readings = readingsQuery.data?.data ?? [];
  const readingsMeta = readingsQuery.data?.meta;
  const alerts = alertsQuery.data?.data ?? [];
  const alertsMeta = alertsQuery.data?.meta;
  const hasOpenAlerts = alerts.some((a) => !a.resolvedAt);

  const readingsColumns: DataTableColumn<TemperatureReadingDto>[] = [
    {
      key: 'recordedAt',
      header: t('temperature.recordedAt', 'Vaqti'),
      render: (r) => (
        <span className="tabular-nums">{new Date(r.recordedAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'sensor',
      header: t('temperature.sensors', 'Sensor'),
      primary: true,
      render: (r) => <SensorLabel name={r.locationName} id={r.sensorId} />,
    },
    {
      key: 'temperature',
      header: t('temperature.temperature'),
      align: 'right',
      render: (r) => (
        <span
          className={cx(
            'font-semibold tabular-nums',
            r.alertTriggered ? 'text-danger-fg' : 'text-fg',
          )}
        >
          {r.temperature} {t('temperature.tempUnit')}
        </span>
      ),
    },
    {
      key: 'humidity',
      header: t('temperature.humidity'),
      align: 'right',
      render: (r) => (
        <span className="tabular-nums">{r.humidity != null ? `${r.humidity}%` : '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t('temperature.status', 'Holat'),
      render: (r) =>
        r.alertTriggered ? (
          <StatusPill tone="danger">{t('temperature.alert', 'Chegaradan chiqqan')}</StatusPill>
        ) : (
          <StatusPill tone="success">{t('temperature.normal', "Me'yorda")}</StatusPill>
        ),
    },
    {
      key: 'method',
      header: t('temperature.method', 'Usul'),
      hideOnMobile: true,
      render: (r) =>
        r.isManual ? (
          <Badge tone="warning">{t('temperature.manual', "Qo'lda")}</Badge>
        ) : (
          <Badge tone="info">{t('temperature.auto', 'Avtomatik')}</Badge>
        ),
    },
    {
      key: 'recordedBy',
      header: t('temperature.recordedBy', 'Kirituvchi'),
      hideOnMobile: true,
      render: (r) => <span className="text-fg-muted">{r.recordedByName || '—'}</span>,
    },
  ];

  const alertsColumns: DataTableColumn<TemperatureAlertDto>[] = [
    {
      key: 'createdAt',
      header: t('temperature.recordedAt', 'Vaqti'),
      render: (a) => <span className="tabular-nums">{new Date(a.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'sensor',
      header: t('temperature.sensors', 'Sensor'),
      primary: true,
      render: (a) => <SensorLabel name={a.locationName} id={a.sensorId} />,
    },
    {
      key: 'alertType',
      header: t('temperature.alertTypeLabel', 'Xavf turi'),
      render: (a) => <Badge tone="danger">{alertTypeLabel(t, a.alertType)}</Badge>,
    },
    {
      key: 'temperature',
      header: t('temperature.temperature', 'Harorat'),
      align: 'right',
      render: (a) => (
        <span className="font-semibold tabular-nums text-danger-fg">
          {a.temperature} {t('temperature.tempUnit')}
        </span>
      ),
    },
    {
      key: 'resolved',
      header: t('temperature.status', 'Holat'),
      render: (a) =>
        a.resolvedAt ? (
          <StatusPill tone="success">{t('temperature.resolved', 'Yopilgan')}</StatusPill>
        ) : (
          <StatusPill tone="danger" pulse>
            {t('temperature.unresolved', 'Ochiq')}
          </StatusPill>
        ),
    },
    {
      key: 'resolutionNote',
      header: t('temperature.resolutionNote', 'Izoh'),
      hideOnMobile: true,
      render: (a) => <span className="text-fg-muted">{a.resolutionNote || '—'}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (a) =>
        a.resolvedAt || !canWrite ? null : (
          <Button
            size="sm"
            variant="secondary"
            leftIcon="check"
            onClick={() => setAlertToResolve(a)}
          >
            {t('temperature.resolve', 'Yopish')}
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('temperature.title', 'Harorat va namlik monitoringi')}
        description={t(
          'temperature.subtitle',
          'Sensorlar ko‘rsatkichlari, chegaralar va ogohlantirishlar nazorati',
        )}
        actions={
          canWrite && (
            <>
              <Button
                variant="secondary"
                leftIcon="settings"
                onClick={() => setSensorModalOpen(true)}
              >
                {t('temperature.sensorSettings', 'Sensor sozlamalari')}
              </Button>
              <Button leftIcon="plus" onClick={() => setManualModalOpen(true)}>
                {t('temperature.manualReading', "Qo'lda kiritish")}
              </Button>
            </>
          )
        }
      />

      <section aria-labelledby="temperature-current" className="flex flex-col gap-3">
        <h2 id="temperature-current" className="text-base font-semibold text-fg">
          {t('temperature.currentStatus', 'Joriy holat')}
        </h2>
        {isStatusLoading ? (
          <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <span className="sr-only">{t('common.loading')}</span>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="rect" className="h-40" />
            ))}
          </div>
        ) : !statusList || statusList.length === 0 ? (
          <EmptyState
            size="sm"
            icon="thermometer"
            title={t('temperature.noSensors', 'Sensorlar mavjud emas')}
            className="rounded-xl border border-dashed border-line-strong"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statusList.map(({ sensor, latestReading, activeAlertCount, stats24h }) => {
              const isSelected = selectedSensorId === sensor.id;
              return (
                <Pressable
                  key={sensor.id}
                  variant="card"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSensorId(isSelected ? '' : sensor.id)}
                  className={cx(
                    'gap-3',
                    isSelected && 'border-primary ring-2 ring-primary/20',
                    activeAlertCount > 0 && !isSelected && 'border-danger-line',
                  )}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-semibold text-fg">{sensor.locationName}</span>
                      <span className="block font-mono text-xs text-fg-subtle">
                        {sensor.sensorId}
                      </span>
                    </span>
                    {activeAlertCount > 0 ? (
                      <StatusPill tone="danger" pulse>
                        <span>{activeAlertCount}</span>
                        <span className="sr-only"> {t('temperature.alerts')}</span>
                      </StatusPill>
                    ) : (
                      <StatusPill tone="success">{t('temperature.normal', "Me'yorda")}</StatusPill>
                    )}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tabular-nums text-fg">
                      {latestReading
                        ? `${latestReading.temperature} ${t('temperature.tempUnit')}`
                        : '—'}
                    </span>
                    {latestReading?.humidity != null && (
                      <span className="text-sm text-fg-muted">
                        {latestReading.humidity} {t('temperature.humidityUnit')}
                      </span>
                    )}
                  </span>
                  <span className="flex w-full flex-col gap-1 border-t border-line pt-2 text-xs text-fg-muted">
                    <span className="flex justify-between gap-2">
                      <span>{t('temperature.tempRange')}</span>
                      <span className="font-medium tabular-nums text-fg">
                        {sensor.tempMin} – {sensor.tempMax} {t('temperature.tempUnit')}
                      </span>
                    </span>
                    {stats24h && stats24h.readingCount > 0 && (
                      <span className="flex justify-between gap-2">
                        <span>{t('temperature.last24h')}</span>
                        <span className="tabular-nums">
                          {stats24h.minTemp} / {stats24h.maxTemp} {t('temperature.tempUnit')}
                        </span>
                      </span>
                    )}
                  </span>
                </Pressable>
              );
            })}
          </div>
        )}
      </section>

      <TemperatureChart readings={readings} sensor={selectedSensor} />

      <FilterBar>
        <Select
          aria-label={t('temperature.sensors', 'Sensor')}
          className="sm:w-72"
          options={[
            { value: '', label: t('temperature.allSensors', 'Barcha sensorlar') },
            ...sensors.map((s) => ({ value: s.id, label: `${s.locationName} (${s.sensorId})` })),
          ]}
          value={selectedSensorId}
          onChange={setSelectedSensorId}
        />
        {activeTab === 'overview' ? (
          <Checkbox
            label={t('temperature.alertOnly', 'Faqat ogohlantirishlar')}
            checked={readingsAlertOnly}
            onChange={(e) => setReadingsAlertOnly(e.target.checked)}
          />
        ) : (
          <Checkbox
            label={t('temperature.unresolvedOnly', 'Faqat ochiq alertlar')}
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
        )}
      </FilterBar>

      <Tabs
        label={t('temperature.title', 'Harorat')}
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: 'overview',
            label: t('temperature.readings', "Ko'rsatkichlar"),
            content: (
              <div>
                <DataTable
                  caption={t('temperature.readings', "Ko'rsatkichlar")}
                  columns={readingsColumns}
                  rows={readings}
                  rowKey={(r) => r.id}
                  loading={readingsQuery.isLoading}
                  error={readingsQuery.isError}
                  onRetry={() => void readingsQuery.refetch()}
                  emptyText={t('temperature.noReadings', "Ko'rsatkichlar mavjud emas")}
                />
                {readingsMeta && readingsMeta.total > PAGE_SIZE && (
                  <Pagination meta={readingsMeta} onPageChange={setReadingsPage} />
                )}
              </div>
            ),
          },
          {
            id: 'alerts',
            label: (
              <span className="flex items-center gap-1.5">
                {t('temperature.alerts', 'Ogohlantirishlar')}
                {hasOpenAlerts && (
                  <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                )}
              </span>
            ),
            content: (
              <div>
                <DataTable
                  caption={t('temperature.alerts', 'Ogohlantirishlar')}
                  columns={alertsColumns}
                  rows={alerts}
                  rowKey={(a) => a.id}
                  loading={alertsQuery.isLoading}
                  error={alertsQuery.isError}
                  onRetry={() => void alertsQuery.refetch()}
                  emptyText={t('temperature.noAlerts', 'Ogohlantirishlar mavjud emas')}
                />
                {alertsMeta && alertsMeta.total > PAGE_SIZE && (
                  <Pagination meta={alertsMeta} onPageChange={setAlertsPage} />
                )}
              </div>
            ),
          },
        ]}
      />

      <ManualReadingModal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        sensors={sensors}
        defaultSensorId={selectedSensorId}
      />
      <SensorConfigModal
        open={sensorModalOpen}
        onClose={() => setSensorModalOpen(false)}
        sensors={sensors}
      />
      <ResolveAlertModal
        open={alertToResolve != null}
        onClose={() => setAlertToResolve(null)}
        alert={alertToResolve}
      />
    </>
  );
}
