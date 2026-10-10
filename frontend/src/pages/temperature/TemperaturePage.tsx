import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import {
  useAlertsQuery,
  useReadingsQuery,
  useSensorsQuery,
  useTemperatureStatusQuery,
} from '@/hooks/useTemperature';
import { useAuthStore } from '@/store/authStore';
import type { TemperatureAlertDto, TemperatureReadingDto } from '@/types';
import { ManualReadingModal } from './ManualReadingModal';
import { ResolveAlertModal } from './ResolveAlertModal';
import { SensorConfigModal } from './SensorConfigModal';
import { TemperatureChart } from './TemperatureChart';

export function TemperaturePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // RBAC: faqat lab_head va admin o'qish kirita oladi, sensorni boshqaradi va alertni yopadi
  const canWrite = user?.role === 'admin' || user?.role === 'lab_head';

  const [activeTab, setActiveTab] = useState<'overview' | 'readings' | 'alerts'>('overview');
  const [selectedSensorId, setSelectedSensorId] = useState<string>('');

  // Modallar
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [sensorModalOpen, setSensorModalOpen] = useState(false);
  const [alertToResolve, setAlertToResolve] = useState<TemperatureAlertDto | null>(null);

  // Ko'rsatkichlar filtri
  const [readingsPage, setReadingsPage] = useState(1);
  const [readingsAlertOnly, setReadingsAlertOnly] = useState(false);

  // Alertlar filtri
  const [alertsPage, setAlertsPage] = useState(1);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);

  // So'rovlar
  const { data: statusList, isLoading: isStatusLoading } = useTemperatureStatusQuery();
  const { data: sensorsList } = useSensorsQuery();

  const readingsQuery = useReadingsQuery({
    page: readingsPage,
    limit: 20,
    sensorConfigId: selectedSensorId || undefined,
    alertOnly: readingsAlertOnly || undefined,
  });

  const alertsQuery = useAlertsQuery({
    page: alertsPage,
    limit: 20,
    sensorConfigId: selectedSensorId || undefined,
    unresolvedOnly: unresolvedOnly || undefined,
  });

  const sensors = sensorsList ?? [];
  const selectedSensor = sensors.find((s) => s.id === selectedSensorId) ?? null;

  const readings = readingsQuery.data?.data ?? [];
  const readingsMeta = readingsQuery.data?.meta;

  const alerts = alertsQuery.data?.data ?? [];
  const alertsMeta = alertsQuery.data?.meta;

  const readingsColumns: Column<TemperatureReadingDto>[] = [
    {
      key: 'recordedAt',
      header: t('temperature.recordedAt', 'Vaqti'),
      render: (r) => new Date(r.recordedAt).toLocaleString(),
    },
    {
      key: 'sensor',
      header: t('temperature.sensors', 'Sensor'),
      render: (r) => (
        <div>
          <div className="font-medium text-slate-800">{r.locationName}</div>
          <div className="text-xs text-slate-400">{r.sensorId}</div>
        </div>
      ),
    },
    {
      key: 'temperature',
      header: t('temperature.temperature'),
      render: (r) => (
        <span
          className={`inline-flex items-center font-semibold ${
            r.alertTriggered ? 'text-rose-600' : 'text-slate-700'
          }`}
        >
          {r.temperature} {t('temperature.tempUnit')}
        </span>
      ),
    },
    {
      key: 'humidity',
      header: t('temperature.humidity'),
      render: (r) => (r.humidity != null ? `${r.humidity}%` : '—'),
    },
    {
      key: 'status',
      header: t('temperature.status', 'Holat'),
      render: (r) =>
        r.alertTriggered ? (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
            {t('temperature.alert', 'Chegaradan chiqqan')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            {t('temperature.normal', "Me'yorda")}
          </span>
        ),
    },
    {
      key: 'method',
      header: t('temperature.method', 'Usul'),
      render: (r) =>
        r.isManual ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
            {t('temperature.manual', "Qo'lda")}
          </span>
        ) : (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 border border-blue-200">
            {t('temperature.auto', 'Avtomatik')}
          </span>
        ),
    },
    {
      key: 'recordedBy',
      header: t('temperature.recordedBy', 'Kirituvchi'),
      render: (r) => r.recordedByName || '—',
    },
  ];

  const alertsColumns: Column<TemperatureAlertDto>[] = [
    {
      key: 'createdAt',
      header: t('temperature.recordedAt', 'Vaqti'),
      render: (a) => new Date(a.createdAt).toLocaleString(),
    },
    {
      key: 'sensor',
      header: t('temperature.sensors', 'Sensor'),
      render: (a) => (
        <div>
          <div className="font-medium text-slate-800">{a.locationName}</div>
          <div className="text-xs text-slate-400">{a.sensorId}</div>
        </div>
      ),
    },
    {
      key: 'alertType',
      header: t('temperature.status', 'Xavf turi'),
      render: (a) => {
        let label = a.alertType;
        if (a.alertType === 'temp_high') label = t('temperature.tempHigh', 'Harorat yuqori');
        else if (a.alertType === 'temp_low') label = t('temperature.tempLow', 'Harorat past');
        else if (a.alertType === 'humidity_high') label = t('temperature.humidityHigh', 'Namlik yuqori');
        else if (a.alertType === 'humidity_low') label = t('temperature.humidityLow', 'Namlik past');

        return (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            {label}
          </span>
        );
      },
    },
    {
      key: 'temperature',
      header: t('temperature.temperature', 'Harorat'),
      render: (a) => <span className="font-bold text-rose-600">{a.temperature} {t('temperature.tempUnit')}</span>,
    },
    {
      key: 'resolved',
      header: t('temperature.status', 'Holat'),
      render: (a) =>
        a.resolvedAt ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            {t('temperature.resolved', 'Yopilgan')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 animate-pulse">
            {t('temperature.unresolved', 'Ochiq')}
          </span>
        ),
    },
    {
      key: 'resolutionNote',
      header: t('temperature.resolutionNote', 'Izoh'),
      render: (a) => a.resolutionNote || '—',
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a) => {
        if (a.resolvedAt || !canWrite) return null;
        return (
          <button
            type="button"
            onClick={() => setAlertToResolve(a)}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            {t('temperature.resolve', 'Yopish')}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sarlavha va amallar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('temperature.title', 'Harorat va namlik monitoringi')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('temperature.subtitle', 'Sensorlar ko‘rsatkichlari, chegaralar va ogohlantirishlar nazorati')}
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <span>+</span>
              <span>{t('temperature.manualReading', "Qo'lda kiritish")}</span>
            </button>
            <button
              type="button"
              onClick={() => setSensorModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>{t('temperature.sensorSettings', 'Sensor sozlamalari')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Joriy holat kartalari (Status cards) */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          {t('temperature.currentStatus', 'Joriy holat')}
        </h2>
        {isStatusLoading ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <Spinner />
          </div>
        ) : !statusList || statusList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
            {t('temperature.noSensors', 'Sensorlar mavjud emas')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statusList.map((item) => {
              const { sensor, latestReading, activeAlertCount, stats24h } = item;
              const isSelected = selectedSensorId === sensor.id;
              const hasAlert = activeAlertCount > 0;

              return (
                <div
                  key={sensor.id}
                  onClick={() => setSelectedSensorId(isSelected ? '' : sensor.id)}
                  className={`cursor-pointer rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{sensor.locationName}</h3>
                      <p className="text-xs text-slate-400">{sensor.sensorId}</p>
                    </div>
                    {hasAlert ? (
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                        <span>{activeAlertCount}</span>
                        <span className="ml-1">{t('temperature.alerts')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {t('temperature.normal', "Me'yorda")}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {latestReading ? (
                        <span>
                          {latestReading.temperature} {t('temperature.tempUnit')}
                        </span>
                      ) : (
                        <span>&mdash;</span>
                      )}
                    </span>
                    {latestReading?.humidity != null && (
                      <span className="text-sm font-medium text-slate-500">
                        {latestReading.humidity} {t('temperature.humidityUnit')}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>{t('temperature.tempRange')}:</span>
                      <span className="font-medium text-slate-700">
                        {sensor.tempMin} &ndash; {sensor.tempMax} {t('temperature.tempUnit')}
                      </span>
                    </div>
                    {stats24h && stats24h.readingCount > 0 && (
                      <div className="mt-1 flex justify-between text-slate-400">
                        <span>{t('temperature.last24h')}:</span>
                        <span>
                          {stats24h.minTemp} / {stats24h.maxTemp} {t('temperature.tempUnit')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grafik */}
      <TemperatureChart readings={readings} sensor={selectedSensor} />

      {/* Tablar va Jadvallar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('temperature.readings', "Ko'rsatkichlar")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'alerts'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('temperature.alerts', 'Ogohlantirishlar')}
              {alerts.filter((a) => !a.resolvedAt).length > 0 && (
                <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-rose-500" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSensorId}
              onChange={(e) => setSelectedSensorId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">{t('reagents.all', 'Barcha sensorlar')}</option>
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.locationName} ({s.sensorId})
                </option>
              ))}
            </select>

            {activeTab === 'overview' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readingsAlertOnly}
                  onChange={(e) => setReadingsAlertOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                {t('temperature.alertOnly', 'Faqat ogohlantirishlar')}
              </label>
            )}

            {activeTab === 'alerts' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unresolvedOnly}
                  onChange={(e) => setUnresolvedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                {t('temperature.unresolvedOnly', 'Faqat ochiq alertlar')}
              </label>
            )}
          </div>
        </div>

        {activeTab === 'overview' ? (
          <div>
            <Table
              columns={readingsColumns}
              rows={readings}
              rowKey={(r) => r.id}
              loading={readingsQuery.isLoading}
              emptyText={t('temperature.noReadings', "Ko'rsatkichlar mavjud emas")}
            />
            {readingsMeta && readingsMeta.total > 20 && (
              <div className="mt-4 flex justify-end">
                <Pagination
                  meta={readingsMeta}
                  onPageChange={setReadingsPage}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <Table
              columns={alertsColumns}
              rows={alerts}
              rowKey={(a) => a.id}
              loading={alertsQuery.isLoading}
              emptyText={t('temperature.noAlerts', 'Ogohlantirishlar mavjud emas')}
            />
            {alertsMeta && alertsMeta.total > 20 && (
              <div className="mt-4 flex justify-end">
                <Pagination
                  meta={alertsMeta}
                  onPageChange={setAlertsPage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modallar */}
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
    </div>
  );
}
