import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { CaseChatPanel } from '@/components/oos/CaseChatPanel';
import { oosErrorText } from '@/components/oos/format';
import { OosStatusPill } from '@/components/oos/OosStatusPill';
import { PeakResultsModal } from '@/components/peaks/PeakResultsModal';
import { canCloseOos, canWriteOos } from '@/config/oos';
import { useAddOosNoteMutation, useOosCaseQuery, useOosStatusMutation } from '@/hooks/useOos';
import { formatDateTime } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { OosCaseDetailDto, OosNoteDto } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DescriptionList,
  DetailLayout,
  EmptyState,
  ErrorState,
  FormField,
  Icon,
  notify,
  PageHeader,
  PageSkeleton,
  Textarea,
} from '@/ui';

const MIN_CLOSE = 5;

/** `status_change` yozuvi: "investigating: izoh" → holat nomi + izoh. */
function NoteText({ note }: { note: OosNoteDto }) {
  const { t, i18n } = useTranslation();
  if (note.kind !== 'status_change') {
    return <p className="whitespace-pre-line break-words text-sm text-fg">{note.text}</p>;
  }
  const [status = '', ...rest] = note.text.split(': ');
  const key = `oos.status.${status}`;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
      <Badge size="sm" tone="info">
        {t('oos.journal.statusChanged', {
          status: i18n.exists(key) ? t(key) : status,
        })}
      </Badge>
      {rest.length > 0 && <span className="whitespace-pre-line">{rest.join(': ')}</span>}
    </p>
  );
}

function Journal({ oos, canWrite }: { oos: OosCaseDetailDto; canWrite: boolean }) {
  const { t } = useTranslation();
  const add = useAddOosNoteMutation(oos.id);
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add.mutate(text.trim(), { onSuccess: () => setText('') });
  };
  return (
    <Card title={t('oos.journal.title')} description={t('oos.journal.description')}>
      <div className="flex flex-col gap-4">
        {oos.notes.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('oos.journal.empty')}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {oos.notes.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 border-l-2 border-line pl-3">
                <span className="text-xs text-fg-muted">
                  {[n.userName, formatDateTime(n.createdAt)].filter(Boolean).join(' · ')}
                </span>
                <NoteText note={n} />
              </li>
            ))}
          </ol>
        )}
        {canWrite && oos.status !== 'closed' && (
          <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line pt-3">
            <FormField label={t('oos.journal.add')}>
              <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            </FormField>
            <Button
              type="submit"
              size="sm"
              className="self-end"
              leftIcon="plus"
              loading={add.isPending}
              disabled={!text.trim()}
            >
              {t('oos.journal.save')}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

/** P19: OOS ishi — natija/spetsifikatsiya, holat amallari (yopish faqat lab_head), jurnal, peaklar va AI kopilot. */
export function OosDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const { data: oos, isLoading, isError, refetch } = useOosCaseQuery(id);
  const statusMutation = useOosStatusMutation(id ?? '');
  const [dialog, setDialog] = useState<'investigate' | 'close' | null>(null);
  const [note, setNote] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [peakFileId, setPeakFileId] = useState<string | null>(null);

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (isError || !oos) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const canWrite = canWriteOos(role);
  const canClose = canCloseOos(role) && oos.status !== 'closed';
  const canInvestigate = canWrite && oos.status === 'open';
  const closeValid = rootCause.trim().length >= MIN_CLOSE && closureNote.trim().length >= MIN_CLOSE;

  const openDialog = (d: 'investigate' | 'close') => {
    setDialogError(null);
    setDialog(d);
  };
  const closeDialog = () => {
    setDialog(null);
    setDialogError(null);
  };
  const onDone = (msg: string) => () => {
    notify.success(msg);
    setNote('');
    setRootCause('');
    setClosureNote('');
    closeDialog();
  };

  const result = [oos.resultValue, oos.unit].filter(Boolean).join(' ');

  return (
    <>
      <PageHeader
        title={[oos.substanceName, oos.testName].filter(Boolean).join(' — ')}
        description={oos.serialNumber ?? undefined}
        back={{ to: '/oos', label: t('oos.title') }}
        meta={<OosStatusPill status={oos.status} />}
        actions={
          <>
            {canInvestigate && (
              <Button
                variant="secondary"
                leftIcon="search"
                onClick={() => openDialog('investigate')}
              >
                {t('oos.actions.investigate')}
              </Button>
            )}
            {canClose && (
              <Button leftIcon="check" onClick={() => openDialog('close')}>
                {t('oos.actions.close')}
              </Button>
            )}
          </>
        }
      />

      <DetailLayout
        aside={
          <Card title={t('oos.peakFiles.title')} description={t('oos.peakFiles.description')}>
            {oos.peakFiles.length === 0 ? (
              <EmptyState size="sm" icon="layers" title={t('oos.peakFiles.empty')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {oos.peakFiles.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon name="file-text" size="sm" className="shrink-0 text-fg-muted" />
                      <span className="truncate text-sm font-medium text-fg">{f.fileName}</span>
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <Badge size="sm" tone={f.confirmedResults > 0 ? 'success' : 'neutral'}>
                        {t('oos.peakFiles.confirmed', { count: f.confirmedResults })}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => setPeakFileId(f.id)}>
                        {t('oos.peakFiles.open')}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        }
      >
        <Alert tone="info">{t('oos.humanDecision')}</Alert>

        <Card title={t('oos.case.title')}>
          <DescriptionList
            columns={2}
            items={[
              { label: t('oos.fields.testName'), value: oos.testName },
              {
                label: t('oos.columns.result'),
                value: (
                  <span className="tabular-nums">
                    {t('oos.resultVsSpec', { result, spec: oos.specLimit })}
                  </span>
                ),
              },
              {
                label: t('oos.case.sample'),
                value: (
                  <Link
                    to={`/samples/${oos.sampleId}`}
                    className="rounded-sm text-primary focus-ring hover:underline"
                  >
                    {[oos.substanceName, oos.serialNumber].filter(Boolean).join(' · ') ||
                      t('oos.case.openSample')}
                  </Link>
                ),
              },
              {
                label: t('oos.case.opened'),
                value: [oos.openedByName, formatDateTime(oos.openedAt)].filter(Boolean).join(' · '),
              },
              oos.description
                ? { label: t('oos.fields.description'), value: oos.description, wide: true }
                : null,
            ]}
          />
        </Card>

        {oos.status === 'closed' && (
          <Card title={t('oos.case.closure')}>
            <DescriptionList
              items={[
                { label: t('oos.fields.rootCause'), value: oos.rootCause, wide: true },
                { label: t('oos.fields.closureNote'), value: oos.closureNote, wide: true },
                {
                  label: t('oos.case.closedBy'),
                  value: [oos.closedByName, oos.closedAt ? formatDateTime(oos.closedAt) : null]
                    .filter(Boolean)
                    .join(' · '),
                },
              ]}
            />
          </Card>
        )}

        <Journal oos={oos} canWrite={canWrite} />

        <CaseChatPanel caseId={oos.id} peakFiles={oos.peakFiles} canWrite={canWrite} />
      </DetailLayout>

      <PeakResultsModal
        fileId={peakFileId}
        canWrite={canWrite}
        onClose={() => setPeakFileId(null)}
      />

      <ConfirmDialog
        open={dialog === 'investigate'}
        title={t('oos.actions.investigateTitle')}
        description={t('oos.actions.investigateText')}
        tone="primary"
        confirmLabel={t('oos.actions.investigate')}
        loading={statusMutation.isPending}
        onCancel={closeDialog}
        onConfirm={() =>
          statusMutation.mutate(
            { status: 'investigating', ...(note.trim() ? { note: note.trim() } : {}) },
            {
              onSuccess: onDone(t('oos.actions.investigated')),
              onError: (err) => setDialogError(oosErrorText(err)),
            },
          )
        }
      >
        <div className="flex flex-col gap-3">
          {dialogError && <Alert tone="danger">{dialogError}</Alert>}
          <FormField label={t('oos.actions.noteOptional')}>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'close'}
        title={t('oos.actions.closeTitle')}
        description={t('oos.actions.closeText')}
        tone="primary"
        confirmLabel={t('oos.actions.close')}
        confirmDisabled={!closeValid}
        loading={statusMutation.isPending}
        onCancel={closeDialog}
        onConfirm={() =>
          statusMutation.mutate(
            { status: 'closed', rootCause: rootCause.trim(), closureNote: closureNote.trim() },
            {
              onSuccess: onDone(t('oos.actions.closed')),
              onError: (err) => setDialogError(oosErrorText(err)),
            },
          )
        }
      >
        <div className="flex flex-col gap-3">
          {dialogError && <Alert tone="danger">{dialogError}</Alert>}
          <FormField
            label={t('oos.fields.rootCause')}
            required
            hint={t('oos.actions.minChars', { min: MIN_CLOSE })}
          >
            <Textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </FormField>
          <FormField
            label={t('oos.fields.closureNote')}
            required
            hint={t('oos.actions.minChars', { min: MIN_CLOSE })}
          >
            <Textarea
              rows={3}
              value={closureNote}
              onChange={(e) => setClosureNote(e.target.value)}
            />
          </FormField>
        </div>
      </ConfirmDialog>
    </>
  );
}
