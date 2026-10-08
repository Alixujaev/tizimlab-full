import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { useSubstancesQuery } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import { useAuthStore } from '@/store/authStore';
import type { Pharmacopoeia, SubstanceDto } from '@/types';
import { SubstanceDeleteModal } from './SubstanceDeleteModal';
import { SubstanceDetailModal } from './SubstanceDetailModal';
import { SubstanceFormModal } from './SubstanceFormModal';

const PHARMACOPOEIA_OPTIONS: Array<{ value: Pharmacopoeia | 'all'; label: string }> = [
  { value: 'all', label: 'Barchasi' },
  { value: 'EP', label: 'EP' },
  { value: 'BP', label: 'BP' },
  { value: 'UzDSt', label: 'UzDSt' },
  { value: 'USP', label: 'USP' },
  { value: 'OTHER', label: 'OTHER' },
];

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

  // Modallar holati
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedSubstance, setSelectedSubstance] = useState<SubstanceDto | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailSubstanceId, setDetailSubstanceId] = useState<string | null>(null);

  useEffect(() => {
    if (routeId) {
      setDetailSubstanceId(routeId);
      setDetailModalOpen(true);
    }
  }, [routeId]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubstance, setDeleteSubstance] = useState<SubstanceDto | null>(null);

  const queryParams = {
    page,
    limit: 20,
    search: search.trim() || undefined,
    pharmacopoeia: pharmacopoeia !== 'all' ? pharmacopoeia : undefined,
    isActive:
      statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined,
  };

  const { data, isLoading, isError } = useSubstancesQuery(queryParams);
  const substances = data?.data ?? [];
  const meta = data?.meta;

  const handleOpenCreate = () => {
    setSelectedSubstance(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (substance: SubstanceDto) => {
    setSelectedSubstance(substance);
    setFormModalOpen(true);
  };

  const handleOpenDetail = (id: string) => {
    setDetailSubstanceId(id);
    setDetailModalOpen(true);
  };

  const handleOpenDelete = (substance: SubstanceDto) => {
    setDeleteSubstance(substance);
    setDeleteModalOpen(true);
  };

  const columns: Column<SubstanceDto>[] = [
    {
      key: 'name',
      header: t('substances.name', 'Modda nomi'),
      render: (item) => {
        const name = getSubstanceName(item, i18n.language);
        return (
          <div>
            <button
              type="button"
              onClick={() => handleOpenDetail(item.id)}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
            >
              {name}
            </button>
            {item.nameRu && i18n.language !== 'ru' && (
              <span className="block text-xs text-slate-400">{item.nameRu}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'pharmacopoeia',
      header: t('substances.pharmacopoeia', 'Farmakopiya'),
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
          {item.pharmacopoeia}
        </span>
      ),
    },
    {
      key: 'casNumber',
      header: t('substances.casNumber', 'CAS raqami'),
      render: (item) => (
        <span className="font-mono text-xs text-slate-600">
          {item.casNumber || '—'}
        </span>
      ),
    },
    {
      key: 'parametersCount',
      header: t('substances.parametersCount', 'Parametrlar'),
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
          {item.parametersCount ?? 0}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: t('common.status', 'Holati'),
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            item.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {item.isActive ? t('common.active', 'Faol') : t('common.inactive', 'Nofaol')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions', 'Amallar'),
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenDetail(item.id)}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            {t('common.view', "Ko'rish")}
          </button>

          {canWrite && (
            <button
              type="button"
              onClick={() => handleOpenEdit(item)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {t('common.edit', 'Tahrirlash')}
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => handleOpenDelete(item)}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              {t('common.delete', "O'chirish")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sarlavha va Yaratish tugmasi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('substances.title', 'Moddalar')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('substances.subtitle', 'Laboratoriya tahlillari va namunalar uchun standart moddalar reyestri')}
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + {t('substances.newSubstance', 'Yangi modda')}
          </button>
        )}
      </div>

      {/* Filtrlar paneli */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="search-substance" className="block text-xs font-medium text-slate-600 mb-1">
            {t('common.search', 'Qidiruv')}
          </label>
          <input
            id="search-substance"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('substances.searchPlaceholder', 'Nomi yoki CAS raqami...')}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="filter-pharmacopoeia" className="block text-xs font-medium text-slate-600 mb-1">
            {t('substances.pharmacopoeia', 'Farmakopiya')}
          </label>
          <select
            id="filter-pharmacopoeia"
            value={pharmacopoeia}
            onChange={(e) => {
              setPharmacopoeia(e.target.value as Pharmacopoeia | 'all');
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PHARMACOPOEIA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 'all' ? t('common.all', 'Barchasi') : opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-status" className="block text-xs font-medium text-slate-600 mb-1">
            {t('common.status', 'Holati')}
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'true' | 'false');
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">{t('common.all', 'Barchasi')}</option>
            <option value="true">{t('common.active', 'Faol')}</option>
            <option value="false">{t('common.inactive', 'Nofaol')}</option>
          </select>
        </div>
      </div>

      {/* Jadval va Kontent */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            {t('common.loadError', 'Ma’lumotlarni yuklashda xatolik yuz berdi')}
          </div>
        ) : substances.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            {t('substances.emptyState', 'Moddalar topilmadi')}
          </div>
        ) : (
          <div>
            <Table
              rows={substances}
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
      <SubstanceFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        substance={selectedSubstance}
      />

      <SubstanceDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailSubstanceId(null);
        }}
        substanceId={detailSubstanceId}
      />

      <SubstanceDeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteSubstance(null);
        }}
        substance={deleteSubstance}
      />
    </div>
  );
}
