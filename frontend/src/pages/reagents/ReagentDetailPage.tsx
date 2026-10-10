import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { getReagentDocumentDownloadUrl } from '@/api/reagents';
import {
  useDeleteDocumentMutation,
  useReagentDocumentsQuery,
  useReagentQuery,
  useTransactionsQuery,
} from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type {
  ReagentDocumentDto,
  ReagentTransactionDto,
  ReagentTransactionType,
} from '@/types';
import { ReagentDocumentModal } from './ReagentDocumentModal';
import { ReagentFormModal } from './ReagentFormModal';
import { ReagentTransactionModal } from './ReagentTransactionModal';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReagentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const canWrite = user?.role === 'admin' || user?.role === 'lab_head';

  const [activeTab, setActiveTab] = useState<'transactions' | 'documents'>('transactions');
  const [txPage, setTxPage] = useState(1);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

  const { data: reagent, isLoading, isError } = useReagentQuery(id ?? '');
  const { data: txData, isLoading: isTxLoading } = useTransactionsQuery(id ?? '', {
    page: txPage,
    limit: 15,
  });
  const { data: docs = [], isLoading: isDocsLoading } = useReagentDocumentsQuery(id ?? '');

  const deleteDocMutation = useDeleteDocumentMutation();

  const handleDownloadDoc = async (docId: string) => {
    if (!id) return;
    try {
      const { url } = await getReagentDocumentDownloadUrl(id, docId);
      window.open(url, '_blank');
    } catch {
      alert(t('common.downloadError', 'Hujjatni yuklab olishda xatolik yuz berdi'));
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id) return;
    if (!window.confirm(t('reagents.deleteDocConfirm', "Haqiqatan ham bu hujjatni o'chirmoqchimisiz?"))) return;
    try {
      await deleteDocMutation.mutateAsync({ reagentId: id, docId });
    } catch {
      alert(t('common.deleteError', "Hujjatni o'chirishda xatolik yuz berdi"));
    }
  };

  const typeBadges: Record<
    ReagentTransactionType,
    { label: string; bg: string; text: string; ring: string }
  > = {
    in: { label: t('reagents.types.in'), bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/20' },
    out: { label: t('reagents.types.out'), bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20' },
    adjustment: { label: t('reagents.types.adjustment'), bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20' },
    disposal: { label: t('reagents.types.disposal'), bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-600/20' },
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (isError || !reagent) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        {t('reagents.notFound', 'Reaktiv topilmadi yoki yuklashda xatolik yuz berdi.')}
        <div className="mt-3">
          <Link to="/reagents" className="text-sm font-semibold underline">
            {t('reagents.backToList', "Reaktivlar ro'yxatiga qaytish")}
          </Link>
        </div>
      </div>
    );
  }

  const txColumns: Column<ReagentTransactionDto>[] = [
    {
      key: 'date',
      header: t('reagents.recordedDate'),
      render: (row) => <span className="font-medium text-slate-900">{formatDate(row.recordedDate)}</span>,
    },
    {
      key: 'type',
      header: t('reagents.transactionType'),
      render: (row) => {
        const badge = typeBadges[row.type] ?? typeBadges.adjustment;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.bg} ${badge.text} ${badge.ring}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'qty',
      header: t('reagents.amount', 'Miqdor'),
      render: (row) => (
        <span className="font-semibold text-slate-800">
          {row.type === 'out' || row.type === 'disposal' ? '-' : '+'}
          {row.quantity} {reagent.unit}
        </span>
      ),
    },
    {
      key: 'after',
      header: t('reagents.balanceBeforeAfter', 'Qoldiq (oldin / keyin)'),
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.quantityBefore} → <strong className="text-slate-800">{row.quantityAfter}</strong> {reagent.unit}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('reagents.staff', 'Xodim'),
      render: (row) => <span className="text-slate-600">{row.userFullName || '—'}</span>,
    },
    {
      key: 'purpose',
      header: t('reagents.analysisPurpose'),
      render: (row) => (
        <span className="text-slate-600 text-xs">{row.analysisPurpose || row.note || '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Yuqori navigatsiya va sarlavha */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/reagents" className="hover:text-indigo-600 hover:underline">
              {t('reagents.title')}
            </Link>
            <span>/</span>
            <span className="text-slate-700">{reagent.name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {reagent.name}
          </h1>
          {reagent.casNumber && (
            <p className="text-sm text-slate-500">
              {t('reagents.casPrefix', 'CAS:')} {reagent.casNumber}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              <button
                onClick={() => setEditModalOpen(true)}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {t('reagents.edit')}
              </button>
              <button
                onClick={() => setTxModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                + {t('reagents.newTransaction')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tafsilot kartochkasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('reagents.stockStatus', 'Zaxira holati')}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              {reagent.quantity}{' '}
              <span className="text-lg font-normal text-slate-500">{reagent.unit}</span>
            </span>
            <span className="text-xs text-slate-500">
              {t('reagents.minLabel', 'Min:')} {reagent.lowStockThreshold} {reagent.unit}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {reagent.isLowStock && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                {t('reagents.lowStock', 'Zaxirasi kam')}
              </span>
            )}
            {reagent.isExpired && (
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                {t('reagents.expired', "Muddati o'tgan")}
              </span>
            )}
            {reagent.isHazardous && (
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                {t('reagents.hazardous', 'Xavfli modda')}
              </span>
            )}
            {!reagent.isLowStock && !reagent.isExpired && !reagent.isHazardous && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                {t('reagents.normal', 'Zaxira yetarli')}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('reagents.shelfLifeAndSupplier', 'Yaroqlilik va Taʼminot')}
          </div>
          <div className="text-sm">
            <span className="text-slate-500">{t('reagents.expiresAt')}: </span>
            <span className={`font-semibold ${reagent.isExpired ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatDate(reagent.expiresAt)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">{t('reagents.supplier')}: </span>
            <span className="font-semibold text-slate-900">{reagent.supplier || '—'}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('reagents.storageConditions')}
          </div>
          <p className="text-sm text-slate-700">
            {reagent.storageConditions || '—'}
          </p>
        </div>
      </div>

      {/* Tablar: Tranzaksiyalar / Hujjatlar */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'transactions'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t('reagents.transactions')} ({txData?.meta.total ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'documents'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t('reagents.documents')} ({docs.length})
          </button>
        </nav>
      </div>

      {/* Tranzaksiyalar bloki */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {isTxLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="h-6 w-6 text-indigo-600" />
            </div>
          ) : !txData || txData.data.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              {t('reagents.noTransactions')}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Table<ReagentTransactionDto>
                  rows={txData.data}
                  columns={txColumns}
                  rowKey={(t: ReagentTransactionDto) => t.id}
                />
              </div>
              {txData.meta.total > txData.meta.limit && (
                <Pagination
                  meta={txData.meta}
                  onPageChange={setTxPage}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Hujjatlar bloki */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-slate-900">
              {t('reagents.attachedDocs', 'Biriktirilgan hujjatlar')}
            </h3>
            {canWrite && (
              <button
                onClick={() => setDocModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                + {t('reagents.uploadDocument')}
              </button>
            )}
          </div>

          {isDocsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="h-6 w-6 text-indigo-600" />
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              {t('reagents.noDocuments')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docs.map((doc: ReagentDocumentDto) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {doc.docType}
                      </span>
                      <span className="font-semibold text-slate-900 text-sm">{doc.title}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {doc.originalName} ({formatBytes(doc.sizeBytes)})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {t('reagents.uploadedAtLabel', 'Yuklandi:')} {formatDate(doc.uploadedAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownloadDoc(doc.id)}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t('reagents.download')}
                    </button>
                    {canWrite && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modallar */}
      <ReagentFormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        reagent={reagent}
      />

      <ReagentTransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        reagent={reagent}
      />

      <ReagentDocumentModal
        open={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        reagentId={reagent.id}
      />
    </div>
  );
}
