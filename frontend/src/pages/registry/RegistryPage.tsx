import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRegistryQuery } from '@/hooks/useRegistry';
import { formatDate, parseDisplayDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { RegistryItemDto, RegistryListParams, SampleType } from '@/types';
import {
  Alert,
  Button,
  Checkbox,
  DataTable,
  type DataTableColumn,
  DatePicker,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
} from '@/ui';
import { SampleTypeBadge } from '../samples/SampleTypeBadge';
import { RegistryDeleteModal } from './RegistryDeleteModal';
import { canDeleteFromRegistry, downloadRegistryFile } from './registryActions';

const TYPES: SampleType[] = [
  'raw_material',
  'finished_product',
  'reagent',
  'standard_substance',
  'other',
];

interface FilterForm {
  type: SampleType | '';
  substanceName: string;
  serialNumber: string;
  lotNumber: string;
  /** UI ko'rinishida (DD.MM.YYYY) — qo'llashda tekshiriladi (D-110). */
  approvedFrom: string;
  approvedTo: string;
  unfinalizedOnly: boolean;
}

const EMPTY: FilterForm = {
  type: '',
  substanceName: '',
  serialNumber: '',
  lotNumber: '',
  approvedFrom: '',
  approvedTo: '',
  unfinalizedOnly: false,
};

export function RegistryPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [form, setForm] = useState<FilterForm>(EMPTY);
  // Tozalashda sana maydonlari qayta yaratiladi (yozilgan noto'g'ri matn ham o'chadi)
  const [resetKey, setResetKey] = useState(0);
  const [params, setParams] = useState<RegistryListParams>({ page: 1 });
  const [dateError, setDateError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<RegistryItemDto | null>(null);
  const { data, isLoading, isError, refetch } = useRegistryQuery(params);

  const setField = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const apply = (e: FormEvent) => {
    e.preventDefault();
    // UI'da DD.MM.YYYY → API'ga ISO (D-110)
    const from = form.approvedFrom.trim() ? parseDisplayDate(form.approvedFrom) : undefined;
    const to = form.approvedTo.trim() ? parseDisplayDate(form.approvedTo) : undefined;
    if (from === null || to === null) {
      setDateError(t('registry.filters.invalidDate'));
      return;
    }
    if (from && to && from > to) {
      setDateError(t('registry.filters.invalidRange'));
      return;
    }
    setDateError(null);
    setParams({
      page: 1,
      type: form.type || undefined,
      substanceName: form.substanceName.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      lotNumber: form.lotNumber.trim() || undefined,
      approvedFrom: from,
      approvedTo: to,
      unfinalizedOnly: form.unfinalizedOnly || undefined,
    });
  };

  const reset = () => {
    setForm(EMPTY);
    setResetKey((k) => k + 1);
    setDateError(null);
    setParams({ page: 1 });
  };

  const dateField = (key: 'approvedFrom' | 'approvedTo') => (
    <FormField label={t(`registry.filters.${key}`)}>
      <DatePicker
        key={`${key}-${resetKey}`}
        value={parseDisplayDate(form[key]) ?? ''}
        placeholder={t('registry.filters.datePlaceholder')}
        onInputChange={(text) => setField(key, text)}
        onChange={(iso) => setField(key, iso ? formatDate(iso) : '')}
      />
    </FormField>
  );

  const columns: DataTableColumn<RegistryItemDto>[] = [
    {
      key: 'substance',
      header: t('registry.columns.substance'),
      primary: true,
      render: (row) => (
        <Link
          to={`/registry/${row.id}`}
          className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
        >
          {row.substanceName}
        </Link>
      ),
    },
    {
      key: 'type',
      header: t('registry.columns.type'),
      render: (row) => <SampleTypeBadge type={row.type} />,
    },
    {
      key: 'serial',
      header: t('registry.columns.serialNumber'),
      render: (row) => <span className="font-mono text-xs">{row.serialNumber ?? '—'}</span>,
    },
    {
      key: 'lot',
      header: t('registry.columns.lotNumber'),
      render: (row) => <span className="font-mono text-xs">{row.lotNumber ?? '—'}</span>,
    },
    {
      key: 'approvedAt',
      header: t('registry.columns.approvedAt'),
      render: (row) => <span className="tabular-nums">{formatDate(row.approvedAt)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          {row.downloadKind && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon="download"
              onClick={() => void downloadRegistryFile(row.id)}
            >
              {row.downloadKind === 'passport'
                ? t('registry.downloadPassport')
                : t('registry.downloadProtocol')}
            </Button>
          )}
          {canDeleteFromRegistry(role) && (
            <Button variant="danger-ghost" size="sm" onClick={() => setToDelete(row)}>
              {t('registry.delete')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('pages.registry')} description={t('registry.subtitle')} />

      <FilterBar
        onSubmit={apply}
        onReset={reset}
        submitLabel={t('registry.filters.apply')}
        resetLabel={t('registry.filters.reset')}
        extra={
          <>
            <Checkbox
              label={t(
                'registry.filters.unfinalizedOnly',
                'Faqat yakunlanmagan (direktor tasdig‘i kutilayotgan) protokollar',
              )}
              checked={form.unfinalizedOnly}
              onChange={(e) => setField('unfinalizedOnly', e.target.checked)}
            />
            {dateError && <Alert tone="danger">{dateError}</Alert>}
          </>
        }
      >
        <FormField label={t('registry.filters.type')}>
          <Select
            options={[
              { value: '', label: t('common.all') },
              ...TYPES.map((type) => ({ value: type, label: t(`samples.types.${type}`) })),
            ]}
            value={form.type}
            onChange={(v) => setField('type', v)}
          />
        </FormField>
        <FormField label={t('registry.filters.substanceName')}>
          <Input
            value={form.substanceName}
            onChange={(e) => setField('substanceName', e.target.value)}
          />
        </FormField>
        <FormField label={t('registry.filters.serialNumber')}>
          <Input
            value={form.serialNumber}
            onChange={(e) => setField('serialNumber', e.target.value)}
          />
        </FormField>
        <FormField label={t('registry.filters.lotNumber')}>
          <Input value={form.lotNumber} onChange={(e) => setField('lotNumber', e.target.value)} />
        </FormField>
        {dateField('approvedFrom')}
        {dateField('approvedTo')}
      </FilterBar>

      <div>
        <DataTable
          caption={t('pages.registry')}
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="clipboard" title={t('registry.empty')} />}
        />
        {data && data.meta.total > data.meta.limit && (
          <Pagination
            meta={data.meta}
            showSummary
            onPageChange={(page) => setParams((p) => ({ ...p, page }))}
          />
        )}
      </div>

      <RegistryDeleteModal sample={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}
