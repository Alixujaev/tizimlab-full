import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import {
  useDeleteReagentMutation,
  useReagentsQuery,
} from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { ReagentDto } from '@/types';
import { ReagentFormModal } from './ReagentFormModal';

export function ReagentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const canWrite = user?.role === 'admin' || user?.role === 'lab_head';
  const canDelete = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lowStock' | 'expired' | 'hazardous'>('all');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingReagent, setEditingReagent] = useState<ReagentDto | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reagentToDelete, setReagentToDelete] = useState<ReagentDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useDeleteReagentMutation();

  const queryParams = {
    page,
    limit: 20,
    search: search.trim() || undefined,
    isLowStock: filterType === 'lowStock' ? true : undefined,
    isExpired: filterType === 'expired' ? true : undefined,
    isHazardous: filterType === 'hazardous' ? true : undefined,
  };

  const { data, isLoading, isError } = useReagentsQuery(queryParams);
  const reagents = data?.data ?? [];
  const meta = data?.meta;

  const handleDeleteConfirm = async () => {
    if (!reagentToDelete) return;
    try {
      await deleteMutation.mutateAsync(reagentToDelete.id);
      setDeleteModalOpen(false);
      setReagentToDelete(null);
      setDeleteError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.deleteError', "O'chirishda xatolik yuz berdi");
      setDeleteError(msg);
    }
  };

  const columns: Column<ReagentDto>[] = [
    {
      key: 'name',
      header: t('reagents.name'),
      render: (row) => (
        <div>
          <Link
            to={`/reagents/${row.id}`}
            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {row.name}
          </Link>
          {row.casNumber && (
            <div className="text-xs text-slate-500">
              {t('reagents.casPrefix', 'CAS:')} {row.casNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: t('reagents.quantity'),
      render: (row) => (
        <div className="font-semibold text-slate-800">
          {row.quantity} <span className="font-normal text-slate-500">{row.unit}</span>
        </div>
      ),
    },
    {
      key: 'threshold',
      header: t('reagents.lowStockThreshold'),
      render: (row) => (
        <span className="text-slate-600">
          {row.lowStockThreshold} {row.unit}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status', 'Holati'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.isLowStock && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              {t('reagents.lowStock', 'Kam qoldi')}
            </span>
          )}
          {row.isExpired && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
              {t('reagents.expired', "Muddati o'tgan")}
            </span>
          )}
          {row.isHazardous && (
            <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/20">
              {t('reagents.hazardous', 'Xavfli')}
            </span>
          )}
          {!row.isLowStock && !row.isExpired && !row.isHazardous && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {t('reagents.normal', 'Normal')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'expiresAt',
      header: t('reagents.expiresAt'),
      render: (row) => (
        <span className={row.isExpired ? 'font-medium text-rose-600' : 'text-slate-600'}>
          {formatDate(row.expiresAt)}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: t('reagents.supplier'),
      render: (row) => <span className="text-slate-600">{row.supplier || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => navigate(`/reagents/${row.id}`)}
            className="text-xs font-medium text-slate-600 hover:text-indigo-600"
          >
            {t('common.detail', 'Batafsil')}
          </button>
          {canWrite && (
            <button
              onClick={() => {
                setEditingReagent(row);
                setFormModalOpen(true);
              }}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {t('common.edit', 'Tahrirlash')}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                setReagentToDelete(row);
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
              className="text-xs font-medium text-rose-600 hover:text-rose-800"
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
      {/* Yuqori panel va harakatlar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('reagents.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('reagents.subtitle', 'Laboratoriya kimyoviy moddalari zaxirasi va xarajatlari')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/reagents/journal"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t('reagents.expenseLog')}
          </Link>
          <Link
            to="/expenses"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t('reagents.expenses')}
          </Link>
          {canWrite && (
            <button
              onClick={() => {
                setEditingReagent(null);
                setFormModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              + {t('reagents.create')}
            </button>
          )}
        </div>
      </div>

      {/* Filtrlar va Qidiruv */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-full sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setFilterType('all');
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t('reagents.all', 'Barchasi')}
          </button>
          <button
            onClick={() => {
              setFilterType('lowStock');
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'lowStock'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {t('reagents.filterLowStock', 'Kam qolganlar')}
          </button>
          <button
            onClick={() => {
              setFilterType('expired');
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'expired'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            {t('reagents.filterExpired', "Muddati o'tganlar")}
          </button>
          <button
            onClick={() => {
              setFilterType('hazardous');
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'hazardous'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            {t('reagents.filterHazardous', 'Xavflilar')}
          </button>
        </div>
      </div>

      {/* Jadval */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-indigo-600" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          {t('reagents.fetchError', "Reaktivlar ro'yxatini yuklashda xatolik yuz berdi.")}
        </div>
      ) : reagents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          {t('reagents.noReagents')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table<ReagentDto>
              rows={reagents}
              columns={columns}
              rowKey={(r: ReagentDto) => r.id}
            />
          </div>
          {meta && meta.total > meta.limit && (
            <Pagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Reagent Form Modal */}
      <ReagentFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        reagent={editingReagent}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={t('reagents.delete')}
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
              {deleteError}
            </div>
          )}
          <p className="text-sm text-slate-600">
            {t(
              'reagents.deleteConfirm',
              "Haqiqatan ham bu reaktivni o'chirmoqchimisiz? (Tranzaksiyasi bor reaktivni o'chirib bo'lmaydi).",
            )}
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteMutation.isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('common.cancel', 'Bekor qilish')}
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
            >
              {deleteMutation.isPending && <Spinner className="h-4 w-4 text-white" />}
              {t('common.delete', "O'chirish")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
