import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { useSamplesQuery } from '@/hooks/useSamples';
import { useAuthStore } from '@/store/authStore';
import type { SampleDto, SampleStatus, SampleType } from '@/types';
import { SampleAssignModal } from './SampleAssignModal';
import { SampleFormModal } from './SampleFormModal';
import { SampleResumeModal } from './SampleResumeModal';
import { SampleStatusBadge } from './SampleStatusBadge';
import { SampleStopModal } from './SampleStopModal';
import { SampleTypeBadge } from './SampleTypeBadge';

const STATUS_OPTIONS: Array<{ value: SampleStatus | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'common.all' },
  { value: 'pending_assignment', labelKey: 'samples.status.pending_assignment' },
  { value: 'in_progress', labelKey: 'samples.status.in_progress' },
  { value: 'stopped', labelKey: 'samples.status.stopped' },
  { value: 'submitted', labelKey: 'samples.status.submitted' },
  { value: 'approved', labelKey: 'samples.status.approved' },
  { value: 'rejected', labelKey: 'samples.status.rejected' },
];

const TYPE_OPTIONS: Array<{ value: SampleType | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'common.all' },
  { value: 'raw_material', labelKey: 'samples.types.raw_material' },
  { value: 'finished_product', labelKey: 'samples.types.finished_product' },
  { value: 'reagent', labelKey: 'samples.types.reagent' },
  { value: 'standard_substance', labelKey: 'samples.types.standard_substance' },
  { value: 'other', labelKey: 'samples.types.other' },
];

export const SamplesPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // Rollar va ruxsatlar (spec §1, §3)
  const isKontrolyor = user?.role === 'kontrolyor';
  const isLabHead = user?.role === 'lab_head';
  const isChemist = user?.role === 'chemist';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<SampleType | 'all'>('all');

  // Modallar holati
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSampleForAssign, setSelectedSampleForAssign] = useState<SampleDto | null>(null);

  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [selectedSampleForAction, setSelectedSampleForAction] = useState<SampleDto | null>(null);

  const queryParams = {
    page,
    limit: 20,
    search: search.trim() || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  };

  const { data, isLoading, isError } = useSamplesQuery(queryParams);
  const samples = data?.data ?? [];
  const meta = data?.meta;

  const handleOpenAssign = (sample: SampleDto) => {
    setSelectedSampleForAssign(sample);
    setAssignModalOpen(true);
  };

  const handleOpenStop = (sample: SampleDto) => {
    setSelectedSampleForAction(sample);
    setStopModalOpen(true);
  };

  const handleOpenResume = (sample: SampleDto) => {
    setSelectedSampleForAction(sample);
    setResumeModalOpen(true);
  };

  const columns: Column<SampleDto>[] = [
    {
      key: 'substanceName',
      header: t('samples.substanceName', 'Modda nomi'),
      render: (item) => (
        <div>
          <Link
            to={`/samples/${item.id}`}
            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline block"
          >
            {item.substanceName}
          </Link>
          <div className="text-xs text-slate-400 mt-0.5">
            {item.manufacturer || ''}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('samples.type', 'Namuna turi'),
      render: (item) => <SampleTypeBadge type={item.type} />,
    },
    {
      key: 'lotNumber',
      header: t('samples.lotOrSerial', 'Lot / Seriya'),
      render: (item) => (
        <span className="font-mono text-xs text-slate-700">
          {item.lotNumber || item.serialNumber || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status', 'Holati'),
      render: (item) => <SampleStatusBadge status={item.status} />,
    },
    {
      key: 'assignedTo',
      header: t('samples.assignedTo', 'Biriktirilgan'),
      render: (item) => {
        const name = item.assignedToName || item.assigned_to_name;
        return name ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
            {name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            —
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: t('samples.createdAt', 'Kiritilgan sana'),
      render: (item) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions', 'Amallar'),
      render: (item) => {
        const canAssign =
          isLabHead &&
          item.type !== 'reagent' &&
          item.type !== 'standard_substance' &&
          ['pending_assignment', 'in_progress', 'stopped', 'rejected'].includes(item.status);

        const canStop =
          isChemist &&
          item.assignedTo === user?.id &&
          item.status === 'in_progress';

        const canResume =
          isChemist &&
          item.assignedTo === user?.id &&
          item.status === 'stopped';

        return (
          <div className="flex items-center gap-2">
            <Link
              to={`/samples/${item.id}`}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              {t('common.view', 'Ko‘rish')}
            </Link>

            {canAssign && (
              <button
                type="button"
                onClick={() => handleOpenAssign(item)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {item.assignedTo
                  ? t('samples.reassign', 'Qayta biriktirish')
                  : t('samples.assign', 'Biriktirish')}
              </button>
            )}

            {canStop && (
              <button
                type="button"
                onClick={() => handleOpenStop(item)}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium"
              >
                {t('samples.stopAnalysis', 'To‘xtatish')}
              </button>
            )}

            {canResume && (
              <button
                type="button"
                onClick={() => handleOpenResume(item)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {t('samples.resumeAnalysis', 'Davom ettirish')}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sarlavha va Yangi namuna tugmasi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('samples.title', 'Namunalar')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isKontrolyor
              ? t('samples.subtitleKontrolyor', 'O‘zingiz kiritgan tahlil namunalari ro‘yxati')
              : isChemist
              ? t('samples.subtitleChemist', 'Sizga tahlil o‘tkazish uchun biriktirilgan namunalar')
              : t('samples.subtitleAdmin', 'Laboratoriya tahlillari va namunalar hayot tsikli nazorati')}
          </p>
        </div>

        {isKontrolyor && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + {t('samples.newSample', 'Yangi namuna')}
          </button>
        )}
      </div>

      {/* Filtrlar paneli */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="search-samples" className="block text-xs font-medium text-slate-600 mb-1">
            {t('common.search', 'Qidiruv')}
          </label>
          <input
            id="search-samples"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('samples.searchPlaceholder', 'Modda, lot yoki seriya raqami...')}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="filter-sample-status" className="block text-xs font-medium text-slate-600 mb-1">
            {t('common.status', 'Holati')}
          </label>
          <select
            id="filter-sample-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as SampleStatus | 'all');
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-sample-type" className="block text-xs font-medium text-slate-600 mb-1">
            {t('samples.type', 'Namuna turi')}
          </label>
          <select
            id="filter-sample-type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as SampleType | 'all');
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Jadval va ro'yxat */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            {t('common.loadError', 'Ma’lumotlarni yuklashda xatolik yuz berdi')}
          </div>
        ) : samples.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            {t('samples.emptyState', 'Namunalar topilmadi')}
          </div>
        ) : (
          <div>
            <Table
              rows={samples}
              columns={columns}
              rowKey={(item) => item.id}
            />

            {/* Sahifalash */}
            {meta && meta.total > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div>
                  {t('common.paginationInfo', 'Jami {{total}} tadan {{from}}-{{to}} ko‘rsatilmoqda', {
                    total: meta.total,
                    from: (meta.page - 1) * meta.limit + 1,
                    to: Math.min(meta.page * meta.limit, meta.total),
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={meta.page <= 1}
                    className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    {t('common.prev', 'Oldingi')}
                  </button>
                  <span>
                    {meta.page} / {Math.max(1, Math.ceil(meta.total / meta.limit))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={meta.page * meta.limit >= meta.total}
                    className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    {t('common.next', 'Keyingi')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modallar */}
      {isKontrolyor && (
        <SampleFormModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {isLabHead && (
        <SampleAssignModal
          open={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedSampleForAssign(null);
          }}
          sample={selectedSampleForAssign}
        />
      )}

      <SampleStopModal
        open={stopModalOpen}
        onClose={() => {
          setStopModalOpen(false);
          setSelectedSampleForAction(null);
        }}
        sample={selectedSampleForAction}
      />

      <SampleResumeModal
        open={resumeModalOpen}
        onClose={() => {
          setResumeModalOpen(false);
          setSelectedSampleForAction(null);
        }}
        sample={selectedSampleForAction}
      />
    </div>
  );
};
