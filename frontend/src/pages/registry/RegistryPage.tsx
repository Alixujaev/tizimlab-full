import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Pagination } from '@/components/ui/Pagination';
import { Table, type Column } from '@/components/ui/Table';
import { useRegistryQuery } from '@/hooks/useRegistry';
import { formatDate, parseDisplayDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { RegistryItemDto, RegistryListParams, SampleType } from '@/types';
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

const inputCls = 'mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm';

export const RegistryPage: React.FC = () => {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [form, setForm] = useState<FilterForm>(EMPTY);
  const [params, setParams] = useState<RegistryListParams>({ page: 1 });
  const [dateError, setDateError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<RegistryItemDto | null>(null);
  const { data, isLoading } = useRegistryQuery(params);

  const set =
    (key: keyof FilterForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const apply = (e: React.FormEvent) => {
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
    setDateError(null);
    setParams({ page: 1 });
  };

  const columns: Column<RegistryItemDto>[] = [
    {
      key: 'substance',
      header: t('registry.columns.substance'),
      render: (row) => (
        <Link to={`/registry/${row.id}`} className="font-medium text-blue-700 hover:underline">
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
      render: (row) => row.serialNumber ?? '—',
    },
    { key: 'lot', header: t('registry.columns.lotNumber'), render: (row) => row.lotNumber ?? '—' },
    {
      key: 'approvedAt',
      header: t('registry.columns.approvedAt'),
      render: (row) => formatDate(row.approvedAt),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.downloadKind && (
            <button
              type="button"
              onClick={() => void downloadRegistryFile(row.id)}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              {row.downloadKind === 'passport'
                ? t('registry.downloadPassport')
                : t('registry.downloadProtocol')}
            </button>
          )}
          {canDeleteFromRegistry(role) && (
            <button
              type="button"
              onClick={() => setToDelete(row)}
              className="text-xs font-medium text-rose-700 hover:underline"
            >
              {t('registry.delete')}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t('pages.registry')}</h1>
        <p className="text-sm text-slate-500">{t('registry.subtitle')}</p>
      </div>

      <form
        onSubmit={apply}
        noValidate
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3"
      >
        <label className="text-xs font-medium text-slate-600">
          {t('registry.filters.type')}
          <select value={form.type} onChange={set('type')} className={inputCls}>
            <option value="">{t('common.all')}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`samples.types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          {t('registry.filters.substanceName')}
          <input value={form.substanceName} onChange={set('substanceName')} className={inputCls} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {t('registry.filters.serialNumber')}
          <input value={form.serialNumber} onChange={set('serialNumber')} className={inputCls} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {t('registry.filters.lotNumber')}
          <input value={form.lotNumber} onChange={set('lotNumber')} className={inputCls} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {t('registry.filters.approvedFrom')}
          <input
            value={form.approvedFrom}
            onChange={set('approvedFrom')}
            placeholder={t('registry.filters.datePlaceholder')}
            inputMode="numeric"
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {t('registry.filters.approvedTo')}
          <input
            value={form.approvedTo}
            onChange={set('approvedTo')}
            placeholder={t('registry.filters.datePlaceholder')}
            inputMode="numeric"
            className={inputCls}
          />
        </label>
        <div className="sm:col-span-3 flex items-center pt-1">
          <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.unfinalizedOnly}
              onChange={(e) => setForm((f) => ({ ...f, unfinalizedOnly: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>{t('registry.filters.unfinalizedOnly', 'Faqat yakunlanmagan (direktor tasdig‘i kutilayotgan) protokollar')}</span>
          </label>
        </div>
        {dateError && (
          <p role="alert" className="text-xs text-rose-600 sm:col-span-3">
            {dateError}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-3">
          <button
            type="submit"
            className="px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('registry.filters.apply')}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-1.5 text-sm rounded border border-slate-300"
          >
            {t('registry.filters.reset')}
          </button>
        </div>
      </form>

      <Table
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyText={t('registry.empty')}
      />
      {data && data.meta.total > data.meta.limit && (
        <Pagination meta={data.meta} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
      )}

      <RegistryDeleteModal sample={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
};
