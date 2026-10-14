import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSamplesQuery } from '@/hooks/useSamples';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { SampleDto, SampleStatus, SampleType } from '@/types';
import {
  Badge,
  Button,
  ButtonLink,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
} from '@/ui';
import { SampleAssignModal } from './SampleAssignModal';
import { SampleFormModal } from './SampleFormModal';
import { SampleResumeModal } from './SampleResumeModal';
import { SampleStatusBadge } from './SampleStatusBadge';
import { SampleStopModal } from './SampleStopModal';
import { SampleTypeBadge } from './SampleTypeBadge';

const STATUSES: SampleStatus[] = [
  'pending_assignment',
  'in_progress',
  'stopped',
  'submitted',
  'approved',
  'rejected',
];
const TYPES: SampleType[] = [
  'raw_material',
  'finished_product',
  'reagent',
  'standard_substance',
  'other',
];
const ASSIGNABLE: SampleStatus[] = ['pending_assignment', 'in_progress', 'stopped', 'rejected'];

export function SamplesPage() {
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

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignSample, setAssignSample] = useState<SampleDto | null>(null);
  const [stopSample, setStopSample] = useState<SampleDto | null>(null);
  const [resumeSample, setResumeSample] = useState<SampleDto | null>(null);

  const { data, isLoading, isError, refetch } = useSamplesQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  });
  const samples = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = !!search || statusFilter !== 'all' || typeFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setPage(1);
  };

  const columns: DataTableColumn<SampleDto>[] = [
    {
      key: 'substanceName',
      header: t('samples.substanceName', 'Modda nomi'),
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <Link
            to={`/samples/${item.id}`}
            className="block rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
          >
            {item.substanceName}
          </Link>
          {item.manufacturer && (
            <div className="mt-0.5 text-xs text-fg-muted">{item.manufacturer}</div>
          )}
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
        <span className="font-mono text-xs text-fg-muted">
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
        return name ? <Badge>{name}</Badge> : <span className="text-fg-subtle">—</span>;
      },
    },
    {
      key: 'createdAt',
      header: t('samples.createdAt', 'Kiritilgan sana'),
      hideOnMobile: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-fg-muted tabular-nums">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions', 'Amallar'),
      align: 'right',
      render: (item) => {
        const canAssign =
          isLabHead &&
          item.type !== 'reagent' &&
          item.type !== 'standard_substance' &&
          ASSIGNABLE.includes(item.status);
        const isMine = isChemist && item.assignedTo === user?.id;
        const canStop = isMine && item.status === 'in_progress';
        const canResume = isMine && item.status === 'stopped';
        return (
          <div className="flex flex-wrap items-center justify-end gap-1">
            <ButtonLink to={`/samples/${item.id}`} variant="ghost" size="sm">
              {t('common.view', 'Ko‘rish')}
            </ButtonLink>
            {canAssign && (
              <Button variant="ghost" size="sm" onClick={() => setAssignSample(item)}>
                {item.assignedTo
                  ? t('samples.reassign', 'Qayta biriktirish')
                  : t('samples.assign', 'Biriktirish')}
              </Button>
            )}
            {canStop && (
              <Button variant="danger-ghost" size="sm" onClick={() => setStopSample(item)}>
                {t('samples.stopAnalysis', 'To‘xtatish')}
              </Button>
            )}
            {canResume && (
              <Button variant="ghost" size="sm" onClick={() => setResumeSample(item)}>
                {t('samples.resumeAnalysis', 'Davom ettirish')}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('samples.title', 'Namunalar')}
        description={
          isKontrolyor
            ? t('samples.subtitleKontrolyor', 'O‘zingiz kiritgan tahlil namunalari ro‘yxati')
            : isChemist
              ? t('samples.subtitleChemist', 'Sizga tahlil o‘tkazish uchun biriktirilgan namunalar')
              : t(
                  'samples.subtitleAdmin',
                  'Laboratoriya tahlillari va namunalar hayot tsikli nazorati',
                )
        }
        actions={
          isKontrolyor && (
            <Button leftIcon="plus" onClick={() => setCreateModalOpen(true)}>
              {t('samples.newSample', 'Yangi namuna')}
            </Button>
          )
        }
      />

      <FilterBar onReset={resetFilters} canReset={hasFilters}>
        <SearchInput
          id="search-samples"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('samples.searchPlaceholder', 'Modda, lot yoki seriya raqami...')}
          aria-label={t('common.search', 'Qidiruv')}
          className="sm:w-72"
        />
        <Select
          id="filter-sample-status"
          aria-label={t('common.status', 'Holati')}
          className="sm:w-48"
          options={[
            { value: 'all', label: `${t('common.status', 'Holati')}: ${t('common.all')}` },
            ...STATUSES.map((s) => ({ value: s, label: t(`samples.status.${s}`) })),
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
        <Select
          id="filter-sample-type"
          aria-label={t('samples.type', 'Namuna turi')}
          className="sm:w-48"
          options={[
            { value: 'all', label: `${t('samples.type', 'Namuna turi')}: ${t('common.all')}` },
            ...TYPES.map((v) => ({ value: v, label: t(`samples.types.${v}`) })),
          ]}
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('samples.title', 'Namunalar')}
          columns={columns}
          rows={samples}
          rowKey={(item) => item.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={
            <EmptyState
              icon="flask"
              title={t('samples.emptyState', 'Namunalar topilmadi')}
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    {t('ui.resetFilters')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
        {meta && meta.total > 0 && <Pagination meta={meta} onPageChange={setPage} showSummary />}
      </div>

      {isKontrolyor && (
        <SampleFormModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      )}
      {isLabHead && (
        <SampleAssignModal
          open={!!assignSample}
          onClose={() => setAssignSample(null)}
          sample={assignSample}
        />
      )}
      <SampleStopModal
        open={!!stopSample}
        onClose={() => setStopSample(null)}
        sample={stopSample}
      />
      <SampleResumeModal
        open={!!resumeSample}
        onClose={() => setResumeSample(null)}
        sample={resumeSample}
      />
    </>
  );
}
