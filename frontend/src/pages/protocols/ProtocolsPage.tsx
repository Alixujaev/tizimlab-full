import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { getProtocolExtraFileDownload } from '@/api/protocols';
import { useEquipmentQuery } from '@/hooks/useP17';
import { useProtocolsListQuery } from '@/hooks/useProtocols';
import { useRegistryChemistsQuery } from '@/hooks/useRegistry';
import { formatDate } from '@/lib/date';
import { errorMessage } from '@/lib/queryClient';
import type { ProtocolListItemDto, ProtocolListParams, ProtocolStatus } from '@/types';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  DataTable,
  type DataTableColumn,
  DatePicker,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  notify,
  PageHeader,
  Pagination,
  Select,
} from '@/ui';
import { ProtocolStatusPill } from '../samples/ProtocolSection';

const STATUSES: ProtocolStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'finalized'];

interface FilterForm {
  substanceName: string;
  series: string;
  dateFrom: string;
  dateTo: string;
  chemistId: string;
  equipmentId: string;
  status: ProtocolStatus | '';
  hasPeaks: boolean;
}

const EMPTY: FilterForm = {
  substanceName: '',
  series: '',
  dateFrom: '',
  dateTo: '',
  chemistId: '',
  equipmentId: '',
  status: '',
  hasPeaks: false,
};

/** P18 (D-187): protokollar ro'yxati — modda, seriya, sana, kimyogar, apparat, holat va peak fayllar bo'yicha. */
export function ProtocolsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FilterForm>(EMPTY);
  // Tozalashda sana maydonlari qayta yaratiladi
  const [resetKey, setResetKey] = useState(0);
  const [params, setParams] = useState<ProtocolListParams>({ page: 1, limit: 20 });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useProtocolsListQuery(params);
  const { data: chemists = [] } = useRegistryChemistsQuery();
  const { data: equipment } = useEquipmentQuery({ limit: 100 });

  const setField = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
      setRangeError(t('protocolsList.invalidRange'));
      return;
    }
    setRangeError(null);
    setParams({
      page: 1,
      limit: 20,
      substanceName: form.substanceName.trim() || undefined,
      series: form.series.trim() || undefined,
      dateFrom: form.dateFrom || undefined,
      dateTo: form.dateTo || undefined,
      chemistId: form.chemistId || undefined,
      equipmentId: form.equipmentId || undefined,
      status: form.status || undefined,
      hasPeaks: form.hasPeaks ? 'true' : undefined,
    });
  };

  const reset = () => {
    setForm(EMPTY);
    setResetKey((k) => k + 1);
    setRangeError(null);
    setParams({ page: 1, limit: 20 });
  };

  const downloadPeak = async (protocolId: string, fileId: string) => {
    try {
      setDownloadingId(fileId);
      const { url } = await getProtocolExtraFileDownload(protocolId, fileId);
      window.open(url, '_blank');
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: DataTableColumn<ProtocolListItemDto>[] = [
    {
      key: 'substance',
      header: t('protocolsList.columns.substance'),
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/samples/${row.sampleId}`}
            className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
          >
            {row.substanceName}
          </Link>
          <div className="text-xs text-fg-muted">
            {t(`protocols.roles.${row.protocolRole}`, row.protocolRole)}
          </div>
        </div>
      ),
    },
    {
      key: 'series',
      header: t('protocolsList.columns.series'),
      render: (row) => (
        <span className="font-mono text-xs">
          {[row.serialNumber, row.lotNumber].filter(Boolean).join(' / ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          <ProtocolStatusPill status={row.status} />
          {row.rejectionCount > 0 && (
            <Badge size="sm" tone="danger">
              {t('protocolsList.rejections', { count: row.rejectionCount })}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'chemist',
      header: t('protocolsList.columns.chemist'),
      render: (row) => <span className="text-fg-muted">{row.chemistName ?? '—'}</span>,
    },
    {
      key: 'equipment',
      header: t('protocolsList.columns.equipment'),
      render: (row) => (
        <span className="text-fg-muted">
          {row.equipmentName ?? t('protocols.equipment.unknown')}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('protocolsList.columns.analysisDate'),
      render: (row) => (
        <span className="tabular-nums">{formatDate(row.analysisDate ?? row.date)}</span>
      ),
    },
    {
      key: 'peaks',
      header: t('protocolsList.columns.peaks'),
      render: (row) =>
        row.peakFiles.length === 0 ? (
          <span className="text-fg-muted">—</span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            {row.peakFiles.map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                size="sm"
                leftIcon="download"
                loading={downloadingId === p.id}
                onClick={() => void downloadPeak(row.id, p.id)}
              >
                {p.fileName}
              </Button>
            ))}
          </div>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (row) => (
        <ButtonLink to={`/samples/${row.sampleId}`} variant="ghost" size="sm">
          {t('protocolsList.open')}
        </ButtonLink>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('protocolsList.title')} description={t('protocolsList.subtitle')} />

      <FilterBar
        onSubmit={apply}
        onReset={reset}
        submitLabel={t('registry.filters.apply')}
        resetLabel={t('registry.filters.reset')}
        extra={
          <>
            <Checkbox
              label={t('protocolsList.filters.hasPeaks')}
              checked={form.hasPeaks}
              onChange={(e) => setField('hasPeaks', e.target.checked)}
            />
            {rangeError && <Alert tone="danger">{rangeError}</Alert>}
          </>
        }
      >
        <FormField label={t('protocolsList.filters.substanceName')}>
          <Input
            value={form.substanceName}
            onChange={(e) => setField('substanceName', e.target.value)}
          />
        </FormField>
        <FormField label={t('protocolsList.filters.series')}>
          <Input value={form.series} onChange={(e) => setField('series', e.target.value)} />
        </FormField>
        <FormField label={t('protocolsList.filters.chemist')}>
          <Select
            options={[
              { value: '', label: t('common.all') },
              ...chemists.map((c) => ({ value: c.id, label: c.fullName })),
            ]}
            value={form.chemistId}
            onChange={(v) => setField('chemistId', v)}
          />
        </FormField>
        <FormField label={t('protocolsList.filters.equipment')}>
          <Select
            options={[
              { value: '', label: t('common.all') },
              { value: 'unknown', label: t('protocolsList.filters.equipmentUnknown') },
              ...(equipment?.data ?? []).map((eq) => ({
                value: eq.id,
                label: `${eq.name} (${eq.category})`,
              })),
            ]}
            value={form.equipmentId}
            onChange={(v) => setField('equipmentId', v)}
          />
        </FormField>
        <FormField label={t('protocolsList.filters.status')}>
          <Select
            options={[
              { value: '', label: t('common.all') },
              ...STATUSES.map((st) => ({ value: st, label: t(`protocols.status.${st}`) })),
            ]}
            value={form.status}
            onChange={(v) => setField('status', v)}
          />
        </FormField>
        <FormField label={t('protocolsList.filters.dateFrom')}>
          <DatePicker
            key={`from-${resetKey}`}
            value={form.dateFrom}
            onChange={(v) => setField('dateFrom', v)}
          />
        </FormField>
        <FormField label={t('protocolsList.filters.dateTo')}>
          <DatePicker
            key={`to-${resetKey}`}
            value={form.dateTo}
            onChange={(v) => setField('dateTo', v)}
          />
        </FormField>
      </FilterBar>

      <div>
        <DataTable
          caption={t('protocolsList.title')}
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="file-text" title={t('protocolsList.empty')} />}
        />
        {data && data.meta.total > data.meta.limit && (
          <Pagination
            meta={data.meta}
            showSummary
            onPageChange={(page) => setParams((p) => ({ ...p, page }))}
          />
        )}
      </div>
    </>
  );
}
