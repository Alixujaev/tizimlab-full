import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useSubstancesQuery } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import { useAuthStore } from '@/store/authStore';
import type { Pharmacopoeia, SubstanceDto } from '@/types';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusPill,
} from '@/ui';
import { SubstanceDeleteModal } from './SubstanceDeleteModal';
import { SubstanceDetailModal } from './SubstanceDetailModal';
import { SubstanceFormModal } from './SubstanceFormModal';

const PHARMACOPOEIAS: Pharmacopoeia[] = ['EP', 'BP', 'UzDSt', 'USP', 'OTHER'];

export function SubstancesPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // Ruxsatlar (spec §1, §5, D-30)
  const canWrite = user?.role === 'admin' || user?.role === 'lab_head';
  const canDelete = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pharmacopoeia, setPharmacopoeia] = useState<Pharmacopoeia | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const { id: routeId } = useParams<{ id: string }>();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedSubstance, setSelectedSubstance] = useState<SubstanceDto | null>(null);
  const [detailSubstanceId, setDetailSubstanceId] = useState<string | null>(null);
  const [deleteSubstance, setDeleteSubstance] = useState<SubstanceDto | null>(null);

  // /substances/:id — tafsilot modali darhol ochiladi
  useEffect(() => {
    if (routeId) setDetailSubstanceId(routeId);
  }, [routeId]);

  const { data, isLoading, isError, refetch } = useSubstancesQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    pharmacopoeia: pharmacopoeia !== 'all' ? pharmacopoeia : undefined,
    isActive: statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined,
  });
  const substances = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = !!search || pharmacopoeia !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setPharmacopoeia('all');
    setStatusFilter('all');
    setPage(1);
  };

  const columns: DataTableColumn<SubstanceDto>[] = [
    {
      key: 'name',
      header: t('substances.name', 'Modda nomi'),
      primary: true,
      sortValue: (item) => getSubstanceName(item, i18n.language),
      render: (item) => (
        <div className="min-w-0">
          <span className="font-medium text-fg">{getSubstanceName(item, i18n.language)}</span>
          {item.nameRu && i18n.language !== 'ru' && (
            <span className="block text-xs text-fg-muted">{item.nameRu}</span>
          )}
        </div>
      ),
    },
    {
      key: 'pharmacopoeia',
      header: t('substances.pharmacopoeia', 'Farmakopiya'),
      render: (item) => <Badge tone="primary">{item.pharmacopoeia}</Badge>,
    },
    {
      key: 'casNumber',
      header: t('substances.casNumber', 'CAS raqami'),
      render: (item) => (
        <span className="font-mono text-xs text-fg-muted">{item.casNumber || '—'}</span>
      ),
    },
    {
      key: 'parametersCount',
      header: t('substances.parametersCount', 'Parametrlar'),
      align: 'center',
      sortValue: (item) => item.parametersCount ?? 0,
      render: (item) => <Badge size="sm">{item.parametersCount ?? 0}</Badge>,
    },
    {
      key: 'isActive',
      header: t('common.status', 'Holati'),
      render: (item) => (
        <StatusPill tone={item.isActive ? 'success' : 'neutral'}>
          {item.isActive ? t('common.active', 'Faol') : t('common.inactive', 'Nofaol')}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions', 'Amallar'),
      align: 'right',
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDetailSubstanceId(item.id)}>
            {t('common.view', "Ko'rish")}
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedSubstance(item);
                setFormModalOpen(true);
              }}
            >
              {t('common.edit', 'Tahrirlash')}
            </Button>
          )}
          {canDelete && (
            <Button variant="danger-ghost" size="sm" onClick={() => setDeleteSubstance(item)}>
              {t('common.delete', "O'chirish")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('substances.title', 'Moddalar')}
        description={t(
          'substances.subtitle',
          'Laboratoriya tahlillari va namunalar uchun standart moddalar reyestri',
        )}
        actions={
          canWrite && (
            <Button
              leftIcon="plus"
              onClick={() => {
                setSelectedSubstance(null);
                setFormModalOpen(true);
              }}
            >
              {t('substances.newSubstance', 'Yangi modda')}
            </Button>
          )
        }
      />

      <FilterBar onReset={resetFilters} canReset={hasFilters}>
        <SearchInput
          id="search-substance"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('substances.searchPlaceholder', 'Nomi yoki CAS raqami...')}
          aria-label={t('common.search', 'Qidiruv')}
          className="sm:w-72"
        />
        <Select
          id="filter-pharmacopoeia"
          aria-label={t('substances.pharmacopoeia', 'Farmakopiya')}
          className="sm:w-48"
          options={[
            {
              value: 'all',
              label: `${t('substances.pharmacopoeia', 'Farmakopiya')}: ${t('common.all')}`,
            },
            ...PHARMACOPOEIAS.map((p) => ({ value: p, label: p })),
          ]}
          value={pharmacopoeia}
          onChange={(v) => {
            setPharmacopoeia(v);
            setPage(1);
          }}
        />
        <Select
          id="filter-status"
          aria-label={t('common.status', 'Holati')}
          className="sm:w-44"
          options={[
            { value: 'all', label: `${t('common.status', 'Holati')}: ${t('common.all')}` },
            { value: 'true', label: t('common.active', 'Faol') },
            { value: 'false', label: t('common.inactive', 'Nofaol') },
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('substances.title', 'Moddalar')}
          columns={columns}
          rows={substances}
          rowKey={(item) => item.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={
            <EmptyState icon="beaker" title={t('substances.emptyState', 'Moddalar topilmadi')} />
          }
        />
        {meta && meta.total > 0 && <Pagination meta={meta} onPageChange={setPage} showSummary />}
      </div>

      <SubstanceFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        substance={selectedSubstance}
      />
      <SubstanceDetailModal
        open={!!detailSubstanceId}
        onClose={() => setDetailSubstanceId(null)}
        substanceId={detailSubstanceId}
      />
      <SubstanceDeleteModal
        open={!!deleteSubstance}
        onClose={() => setDeleteSubstance(null)}
        substance={deleteSubstance}
      />
    </>
  );
}
