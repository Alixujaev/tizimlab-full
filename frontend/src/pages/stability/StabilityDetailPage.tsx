import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  useCompleteCheckpointMutation,
  useDeleteCheckpointMutation,
  useStabilityStudyQuery,
} from '@/hooks/useStability';
import { formatDate } from '@/lib/date';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { StabilityCheckpointDto, StabilityResultDto } from '@/types';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DescriptionList,
  EmptyState,
  PageHeader,
  PageSkeleton,
} from '@/ui';
import { CreateCheckpointModal } from './CreateCheckpointModal';
import { RecordResultsModal } from './RecordResultsModal';
import { CheckpointStatusBadge, ResultStatusBadge, StudyStatusBadge } from './StabilityStatusBadge';

type PendingAction = { kind: 'delete' | 'complete'; checkpoint: StabilityCheckpointDto };

export function StabilityDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: study, isLoading, isError } = useStabilityStudyQuery(id ?? '');
  const deleteCheckpointMutation = useDeleteCheckpointMutation(id ?? '');
  const completeCheckpointMutation = useCompleteCheckpointMutation(id ?? '');

  const [createCpOpen, setCreateCpOpen] = useState(false);
  const [activeCpForResults, setActiveCpForResults] = useState<StabilityCheckpointDto | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (isError || !study) {
    return (
      <EmptyState
        titleAs="h1"
        icon="clock"
        title={t('stability.notFound', 'Stabilizatsiya tekshiruvi topilmadi')}
        action={
          <ButtonLink to="/stability" leftIcon="arrow-left">
            {t('stability.backToList', 'Ro‘yxatga qaytish')}
          </ButtonLink>
        }
        className="py-20"
      />
    );
  }

  const role = user?.role;
  const canStart = role === 'lab_head' || role === 'director' || role === 'admin';
  const canRecordBase = role === 'chemist' || canStart;
  const canRecordCheckpoint = (cp: StabilityCheckpointDto) =>
    canRecordBase && (role !== 'chemist' || Boolean(user?.id && cp.assignedTo === user.id));

  const runPending = async () => {
    if (!pending) return;
    setActionError(null);
    try {
      if (pending.kind === 'delete')
        await deleteCheckpointMutation.mutateAsync(pending.checkpoint.id);
      else await completeCheckpointMutation.mutateAsync({ checkpointId: pending.checkpoint.id });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const resultColumns: DataTableColumn<StabilityResultDto>[] = [
    {
      key: 'parameter',
      header: t('stability.parameter'),
      primary: true,
      render: (r) => <span className="font-medium">{r.parameter}</span>,
    },
    {
      key: 'initial',
      header: t('stability.initialValue'),
      render: (r) => <span className="text-fg-muted">{r.initialValue ?? '—'}</span>,
    },
    {
      key: 'current',
      header: t('stability.currentValue'),
      render: (r) =>
        r.currentValue ?? <span className="text-fg-subtle">{t('stability.notRecorded')}</span>,
    },
    {
      key: 'spec',
      header: t('stability.specification'),
      render: (r) => <span className="text-fg-muted">{r.specification ?? '—'}</span>,
    },
    {
      key: 'status',
      header: t('stability.resultStatus'),
      render: (r) => (r.currentValue ? <ResultStatusBadge status={r.resultStatus} /> : '—'),
    },
    {
      key: 'by',
      header: t('common.recordedBy', 'Kirituvchi'),
      hideOnMobile: true,
      render: (r) => <span className="text-xs text-fg-muted">{r.recordedByName ?? '—'}</span>,
    },
  ];

  const busy = deleteCheckpointMutation.isPending || completeCheckpointMutation.isPending;

  return (
    <>
      <PageHeader
        back={{ to: '/stability', label: t('stability.title') }}
        title={`${study.substanceName}${study.serialNumber ? ` (${study.serialNumber})` : ''}`}
        meta={<StudyStatusBadge status={study.status} />}
        actions={
          canStart &&
          study.status === 'active' && (
            <Button leftIcon="plus" onClick={() => setCreateCpOpen(true)}>
              {t('stability.addCheckpoint')}
            </Button>
          )
        }
      />

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <Card title={t('stability.detailTitle')}>
        <DescriptionList
          columns={3}
          items={[
            {
              label: t('stability.sample'),
              value: (
                <Link
                  to={`/samples/${study.sampleId}`}
                  className="rounded-sm font-medium text-primary-subtle-fg focus-ring hover:underline"
                >
                  {study.substanceName}
                </Link>
              ),
            },
            { label: t('stability.serialNumber'), value: study.serialNumber, mono: true },
            { label: t('stability.startedAt'), value: formatDate(study.startedAt) },
            { label: t('stability.storageConditions'), value: study.storageConditions },
          ]}
        />
      </Card>

      <section aria-labelledby="stability-checkpoints" className="flex flex-col gap-4">
        <h2 id="stability-checkpoints" className="text-lg font-semibold text-fg">
          {t('stability.checkpoints')} ({study.checkpoints.length})
        </h2>
        {study.checkpoints.length === 0 ? (
          <EmptyState
            icon="clock"
            title={t('stability.noCheckpoints')}
            className="rounded-xl border border-dashed border-line-strong"
          />
        ) : (
          study.checkpoints.map((cp) => {
            const canRecord = canRecordCheckpoint(cp);
            const isCompleted = cp.status === 'completed';
            return (
              <Card
                key={cp.id}
                flush
                title={
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold">{cp.intervalTag}</span>
                    <CheckpointStatusBadge status={cp.status} isDueSoon={cp.isDueSoon} />
                  </span>
                }
                description={
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      {t('stability.dueDate')}:{' '}
                      <strong className="text-fg">{formatDate(cp.dueDate)}</strong>
                    </span>
                    {cp.assignedToName && (
                      <span>
                        {t('stability.assignedTo')}:{' '}
                        <strong className="text-fg">{cp.assignedToName}</strong>
                      </span>
                    )}
                  </span>
                }
                actions={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {canRecord && !isCompleted && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon="edit"
                          onClick={() => setActiveCpForResults(cp)}
                        >
                          {t('stability.recordResults')}
                        </Button>
                        <Button
                          size="sm"
                          leftIcon="check"
                          onClick={() => setPending({ kind: 'complete', checkpoint: cp })}
                        >
                          {t('stability.complete')}
                        </Button>
                      </>
                    )}
                    {canStart && cp.status === 'pending' && (
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        onClick={() => setPending({ kind: 'delete', checkpoint: cp })}
                      >
                        {t('common.delete')}
                      </Button>
                    )}
                  </div>
                }
              >
                <div className="p-4">
                  <DataTable
                    columns={resultColumns}
                    rows={cp.results ?? []}
                    rowKey={(r) => r.id}
                    emptyText={t('stability.noParams')}
                  />
                </div>
              </Card>
            );
          })
        )}
      </section>

      {createCpOpen && (
        <CreateCheckpointModal
          studyId={study.id}
          isOpen={createCpOpen}
          onClose={() => setCreateCpOpen(false)}
        />
      )}
      {activeCpForResults && (
        <RecordResultsModal
          studyId={study.id}
          checkpoint={activeCpForResults}
          isOpen
          onClose={() => setActiveCpForResults(null)}
        />
      )}
      <ConfirmDialog
        open={!!pending}
        tone={pending?.kind === 'complete' ? 'primary' : 'danger'}
        title={pending ? `${pending.checkpoint.intervalTag}` : ''}
        description={
          pending?.kind === 'complete'
            ? t(
                'stability.completeConfirm',
                'Barcha parametrlar to‘ldirilgan bo‘lsa, ushbu checkpoint yakunlanadi. Davom etasizmi?',
              )
            : t('stability.deleteConfirm', 'Ushbu checkpointni o‘chirishni tasdiqlaysizmi?')
        }
        confirmLabel={pending?.kind === 'complete' ? t('stability.complete') : t('common.delete')}
        cancelLabel={t('stability.cancel')}
        loading={busy}
        onConfirm={() => void runPending()}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
