import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { getReagentDocumentDownloadUrl } from '@/api/reagents';
import {
  useDeleteDocumentMutation,
  useReagentDocumentsQuery,
  useReagentQuery,
  useTransactionsQuery,
} from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { ReagentDocumentDto, ReagentTransactionDto, ReagentTransactionType } from '@/types';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DescriptionList,
  EmptyState,
  formatBytes,
  Icon,
  notify,
  PageHeader,
  PageSkeleton,
  Pagination,
  Skeleton,
  StatusPill,
  Tabs,
  type Tone,
} from '@/ui';
import { ReagentDocumentModal } from './ReagentDocumentModal';
import { ReagentFormModal } from './ReagentFormModal';
import { ReagentStatusBadges } from './ReagentStatusBadges';
import { ReagentTransactionModal } from './ReagentTransactionModal';

const TX_TONE: Record<ReagentTransactionType, Tone> = {
  in: 'success',
  out: 'warning',
  adjustment: 'info',
  disposal: 'danger',
};

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
  const [docToDelete, setDocToDelete] = useState<ReagentDocumentDto | null>(null);

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
      notify.error(t('common.downloadError', 'Hujjatni yuklab olishda xatolik yuz berdi'));
    }
  };

  const handleDeleteDoc = async () => {
    if (!id || !docToDelete) return;
    try {
      await deleteDocMutation.mutateAsync({ reagentId: id, docId: docToDelete.id });
      setDocToDelete(null);
    } catch {
      notify.error(t('common.deleteError', "Hujjatni o'chirishda xatolik yuz berdi"));
    }
  };

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (isError || !reagent) {
    return (
      <EmptyState
        titleAs="h1"
        icon="beaker"
        title={t('reagents.notFound', 'Reaktiv topilmadi yoki yuklashda xatolik yuz berdi.')}
        action={
          <ButtonLink to="/reagents" leftIcon="arrow-left">
            {t('reagents.backToList', "Reaktivlar ro'yxatiga qaytish")}
          </ButtonLink>
        }
        className="py-20"
      />
    );
  }

  const txColumns: DataTableColumn<ReagentTransactionDto>[] = [
    {
      key: 'date',
      header: t('reagents.recordedDate'),
      primary: true,
      render: (row) => (
        <span className="font-medium tabular-nums">{formatDate(row.recordedDate)}</span>
      ),
    },
    {
      key: 'type',
      header: t('reagents.transactionType'),
      render: (row) => (
        <StatusPill tone={TX_TONE[row.type] ?? 'info'}>
          {t(`reagents.types.${row.type}`)}
        </StatusPill>
      ),
    },
    {
      key: 'qty',
      header: t('reagents.amount', 'Miqdor'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums">
          {row.type === 'out' || row.type === 'disposal' ? '−' : '+'}
          {row.quantity} {reagent.unit}
        </span>
      ),
    },
    {
      key: 'after',
      header: t('reagents.balanceBeforeAfter', 'Qoldiq (oldin / keyin)'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs tabular-nums text-fg-muted">
          {row.quantityBefore} → <strong className="text-fg">{row.quantityAfter}</strong>{' '}
          {reagent.unit}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('reagents.staff', 'Xodim'),
      render: (row) => <span className="text-fg-muted">{row.userFullName || '—'}</span>,
    },
    {
      key: 'purpose',
      header: t('reagents.analysisPurpose'),
      render: (row) => (
        <span className="text-xs text-fg-muted">{row.analysisPurpose || row.note || '—'}</span>
      ),
    },
  ];

  const loadingBlock = (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton variant="rect" className="h-32 w-full" />
    </div>
  );

  const transactionsPanel = isTxLoading ? (
    loadingBlock
  ) : !txData || txData.data.length === 0 ? (
    <EmptyState size="sm" icon="activity" title={t('reagents.noTransactions')} />
  ) : (
    <div>
      <DataTable columns={txColumns} rows={txData.data} rowKey={(row) => row.id} />
      {txData.meta.total > txData.meta.limit && (
        <Pagination meta={txData.meta} onPageChange={setTxPage} />
      )}
    </div>
  );

  const documentsPanel = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">
          {t('reagents.attachedDocs', 'Biriktirilgan hujjatlar')}
        </h2>
        {canWrite && (
          <Button size="sm" leftIcon="upload" onClick={() => setDocModalOpen(true)}>
            {t('reagents.uploadDocument')}
          </Button>
        )}
      </div>
      {isDocsLoading ? (
        loadingBlock
      ) : docs.length === 0 ? (
        <EmptyState size="sm" icon="file" title={t('reagents.noDocuments')} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-subtle-fg">
                  <Icon name="file-text" size="sm" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">{doc.title}</span>
                    <Badge size="sm">{t(`reagents.docTypes.${doc.docType}`, doc.docType)}</Badge>
                  </div>
                  <p className="truncate text-xs text-fg-muted">
                    {doc.originalName} ({formatBytes(doc.sizeBytes)})
                  </p>
                  <p className="text-xs text-fg-subtle">
                    {t('reagents.uploadedAtLabel', 'Yuklandi:')} {formatDate(doc.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon="download"
                  onClick={() => void handleDownloadDoc(doc.id)}
                >
                  {t('reagents.download')}
                </Button>
                {canWrite && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setDocToDelete(doc)}>
                    {t('common.delete')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        back={{ to: '/reagents', label: t('reagents.title') }}
        title={reagent.name}
        description={
          reagent.casNumber ? `${t('reagents.casPrefix', 'CAS:')} ${reagent.casNumber}` : undefined
        }
        meta={<ReagentStatusBadges reagent={reagent} />}
        actions={
          canWrite && (
            <>
              <Button variant="secondary" leftIcon="edit" onClick={() => setEditModalOpen(true)}>
                {t('reagents.edit')}
              </Button>
              <Button leftIcon="plus" onClick={() => setTxModalOpen(true)}>
                {t('reagents.newTransaction')}
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
            {t('reagents.stockStatus', 'Zaxira holati')}
          </p>
          <p className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tabular-nums text-fg">
              {reagent.quantity}{' '}
              <span className="text-base font-normal text-fg-muted">{reagent.unit}</span>
            </span>
            <span className="text-xs text-fg-muted">
              {t('reagents.minLabel', 'Min:')} {reagent.lowStockThreshold} {reagent.unit}
            </span>
          </p>
        </Card>
        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
            {t('reagents.shelfLifeAndSupplier', 'Yaroqlilik va Taʼminot')}
          </p>
          <DescriptionList
            columns={1}
            items={[
              {
                label: t('reagents.expiresAt'),
                value: (
                  <span className={reagent.isExpired ? 'font-semibold text-danger-fg' : undefined}>
                    {formatDate(reagent.expiresAt)}
                  </span>
                ),
              },
              { label: t('reagents.supplier'), value: reagent.supplier },
            ]}
          />
        </Card>
        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
            {t('reagents.storageConditions')}
          </p>
          <p className="text-sm text-fg">{reagent.storageConditions || '—'}</p>
        </Card>
      </div>

      <Tabs
        label={reagent.name}
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: 'transactions',
            label: t('reagents.transactions'),
            badge: txData?.meta.total ?? 0,
            content: transactionsPanel,
          },
          {
            id: 'documents',
            label: t('reagents.documents'),
            badge: docs.length,
            content: documentsPanel,
          },
        ]}
      />

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
      <ConfirmDialog
        open={!!docToDelete}
        title={t('common.delete')}
        description={t('reagents.deleteDocConfirm', "Haqiqatan ham bu hujjatni o'chirmoqchimisiz?")}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel', 'Bekor qilish')}
        loading={deleteDocMutation.isPending}
        onConfirm={() => void handleDeleteDoc()}
        onCancel={() => setDocToDelete(null)}
      />
    </>
  );
}
