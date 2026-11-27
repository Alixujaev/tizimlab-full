import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiErrorText } from '@/components/ai/AiExtractButton';
import { fmtNum, oosErrorText, parseNum } from '@/components/oos/format';
import { PeakComparisonTable } from '@/components/oos/PeakComparisonTable';
import { canExtractPeaks } from '@/config/oos';
import { useAiEnabled } from '@/hooks/useAi';
import {
  useConfirmPeakResultsMutation,
  useDeletePeakResultMutation,
  useExtractPeaksMutation,
  usePeakComparisonQuery,
  usePeakResultsQuery,
  useSavePeakResultMutation,
} from '@/hooks/useOos';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { PeakResultDto, PeakResultInput } from '@/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  ErrorState,
  FormField,
  IconButton,
  Input,
  Modal,
  notify,
  Skeleton,
  StatusPill,
  Tabs,
} from '@/ui';

type Tab = 'results' | 'comparison';
type Msg = { tone: 'success' | 'info' | 'warning' | 'danger'; text: string };

const FIELDS = [
  'retentionTime',
  'area',
  'areaPercent',
  'height',
  'tailing',
  'plates',
  'resolution',
] as const;
type NumField = (typeof FIELDS)[number];
type RowForm = Record<NumField | 'peakName', string>;

const EMPTY_ROW: RowForm = {
  peakName: '',
  retentionTime: '',
  area: '',
  areaPercent: '',
  height: '',
  tailing: '',
  plates: '',
  resolution: '',
};

const toForm = (r: PeakResultDto): RowForm => ({
  peakName: r.peakName ?? '',
  ...(Object.fromEntries(FIELDS.map((k) => [k, r[k] === null ? '' : String(r[k])])) as Record<
    NumField,
    string
  >),
});

/** Kiritish qoidalari backend bilan bir xil: RT > 0, area% 0..100, tailing > 0, qolgani ≥ 0. */
function validateRow(f: RowForm): {
  input?: PeakResultInput;
  errors: Partial<Record<NumField, string>>;
} {
  const errors: Partial<Record<NumField, string>> = {};
  const values = {} as Record<NumField, number | null>;
  for (const k of FIELDS) {
    const v = parseNum(f[k]);
    values[k] = v;
    if (v !== null && Number.isNaN(v)) errors[k] = 'number';
    else if (k === 'retentionTime' && (v === null || v <= 0)) errors[k] = 'rt';
    else if (k === 'tailing' && v !== null && v <= 0) errors[k] = 'positive';
    else if (k === 'areaPercent' && v !== null && (v < 0 || v > 100)) errors[k] = 'percent';
    else if (v !== null && v < 0) errors[k] = 'nonNegative';
  }
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      peakName: f.peakName.trim() || null,
      retentionTime: values.retentionTime!,
      area: values.area,
      areaPercent: values.areaPercent,
      height: values.height,
      tailing: values.tailing,
      plates: values.plates,
      resolution: values.resolution,
    },
  };
}

const lowConfidence = (r: PeakResultDto) =>
  r.source === 'ai' && (r.aiValue?.confidence === 'low' || r.aiValue?.confidence === 'medium');

/**
 * P19 (D-193): peak faylining natijalari — qo'lda yoki AI (qoralama) kiritish, tasdiqlash va tarix bilan
 * solishtirish. Solishtirishda faqat TASDIQLANGAN qatorlar ishlatiladi. `canWrite` — biriktirilgan kimyogar,
 * lab_head, admin (server ham tekshiradi).
 */
export function PeakResultsModal({
  fileId,
  canWrite,
  onClose,
}: {
  fileId: string | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('results');
  const close = () => {
    setTab('results');
    onClose();
  };
  return (
    <Modal open={Boolean(fileId)} onClose={close} size="xl" title={t('peaks.title')}>
      {fileId && (
        <div className="flex flex-col gap-4">
          <Tabs
            label={t('peaks.title')}
            value={tab}
            onChange={setTab}
            items={[
              { id: 'results', label: t('peaks.tabs.results') },
              { id: 'comparison', label: t('peaks.tabs.comparison') },
            ]}
          />
          {tab === 'results' ? (
            <PeakResultsView fileId={fileId} canWrite={canWrite} />
          ) : (
            <PeakComparisonView fileId={fileId} />
          )}
        </div>
      )}
    </Modal>
  );
}

export function PeakComparisonView({ fileId }: { fileId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = usePeakComparisonQuery(fileId);
  if (isLoading) {
    return (
      <div role="status">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton variant="rect" className="h-32 w-full" />
      </div>
    );
  }
  if (isError || !data) return <ErrorState size="sm" onRetry={() => void refetch()} />;
  return <PeakComparisonTable comparison={data} />;
}

function PeakResultsView({ fileId, canWrite }: { fileId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const formId = useId();
  const role = useAuthStore((s) => s.user?.role);
  const aiEnabled = useAiEnabled();
  const { data, isLoading, isError, refetch } = usePeakResultsQuery(fileId);
  const save = useSavePeakResultMutation(fileId);
  const remove = useDeletePeakResultMutation(fileId);
  const confirm = useConfirmPeakResultsMutation(fileId);
  const extract = useExtractPeaksMutation(fileId);

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [row, setRow] = useState<RowForm>(EMPTY_ROW);
  const [errors, setErrors] = useState<Partial<Record<NumField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState<Msg | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div role="status">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton variant="rect" className="h-32 w-full" />
      </div>
    );
  }
  if (isError || !data) return <ErrorState size="sm" onRetry={() => void refetch()} />;

  const results = data.results;
  const drafts = results.filter((r) => r.status === 'draft');
  const showAi = canWrite && aiEnabled && canExtractPeaks(role);

  const startEdit = (r: PeakResultDto | null) => {
    setEditing(r ? r.id : 'new');
    setRow(r ? toForm(r) : EMPTY_ROW);
    setErrors({});
    setFormError(null);
  };
  const cancelEdit = () => {
    setEditing(null);
    setErrors({});
    setFormError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validateRow(row);
    setErrors(v.errors);
    if (!v.input) return;
    setFormError(null);
    save.mutate(
      { id: editing && editing !== 'new' ? editing : undefined, input: v.input },
      { onSuccess: cancelEdit, onError: (err) => setFormError(oosErrorText(err)) },
    );
  };

  const runExtract = () => {
    setAiMsg(null);
    extract.mutate(undefined, {
      onSuccess: (x) => {
        if (
          x.imageQuality === 'poor' ||
          x.imageQuality === 'unreadable' ||
          x.errorCode === 'AI_POOR_QUALITY'
        ) {
          setAiMsg({ tone: 'warning', text: t('ai.poorQuality') });
        } else if (x.status !== 'ok') {
          setAiMsg({ tone: 'warning', text: t('peaks.ai.failed') });
        } else if (x.created.length === 0) {
          setAiMsg({ tone: 'info', text: t('peaks.ai.nothing') });
        } else {
          setAiMsg({
            tone: 'success',
            text: t('peaks.ai.created', { count: x.created.length, skipped: x.skipped }),
          });
        }
      },
      onError: (err) => setAiMsg({ tone: 'danger', text: aiErrorText(err) }),
    });
  };

  const fieldError = (k: NumField) => (errors[k] ? t(`peaks.validation.${errors[k]}`) : undefined);

  const columns: DataTableColumn<PeakResultDto>[] = [
    {
      key: 'peak',
      header: t('peaks.columns.peak'),
      primary: true,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-fg">{r.peakName ?? t('peaks.unnamed')}</span>
          {r.source === 'ai' && (
            <Badge size="sm" tone="primary">
              {t('ai.badge')}
            </Badge>
          )}
          {lowConfidence(r) && r.status === 'draft' && (
            <Badge size="sm" tone="warning" icon="alert-triangle">
              {t('ai.check')}
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'rt', header: t('peaks.columns.rt'), render: (r) => fmtNum(r.retentionTime) },
    { key: 'area', header: t('peaks.columns.area'), render: (r) => fmtNum(r.area) },
    {
      key: 'areaPct',
      header: t('peaks.columns.areaPercent'),
      render: (r) => fmtNum(r.areaPercent),
    },
    {
      key: 'height',
      header: t('peaks.columns.height'),
      render: (r) => fmtNum(r.height),
      hideOnMobile: true,
    },
    { key: 'tailing', header: t('peaks.columns.tailing'), render: (r) => fmtNum(r.tailing) },
    { key: 'plates', header: t('peaks.columns.plates'), render: (r) => fmtNum(r.plates, 0) },
    { key: 'rs', header: t('peaks.columns.resolution'), render: (r) => fmtNum(r.resolution) },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => (
        <StatusPill tone={r.status === 'confirmed' ? 'success' : 'neutral'}>
          {t(`peaks.status.${r.status}`)}
        </StatusPill>
      ),
    },
  ];
  if (canWrite) {
    columns.push({
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (r) => (
        <span className="flex justify-end gap-1">
          {r.status === 'draft' && (
            <IconButton
              icon="edit"
              size="sm"
              variant="ghost"
              label={t('common.edit')}
              onClick={() => startEdit(r)}
            />
          )}
          {(r.status === 'draft' || role === 'lab_head') && (
            <IconButton
              icon="trash"
              size="sm"
              variant="ghost"
              label={t('common.delete')}
              onClick={() => remove.mutate(r.id)}
            />
          )}
        </span>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        {[
          data.file.fileName,
          data.file.substanceName,
          data.file.equipmentName,
          data.file.analysisDate ? formatDate(data.file.analysisDate) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <Alert tone="info">{t('peaks.confirmHint')}</Alert>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon="plus"
            disabled={editing !== null}
            onClick={() => startEdit(null)}
          >
            {t('peaks.addRow')}
          </Button>
          {showAi && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon="file-text"
              loading={extract.isPending}
              onClick={runExtract}
            >
              {t('peaks.ai.extract')}
            </Button>
          )}
          {drafts.length > 0 && (
            <Button size="sm" leftIcon="check" onClick={() => setConfirmOpen(true)}>
              {t('peaks.confirm')}
            </Button>
          )}
        </div>
      )}
      {extract.isPending && <p className="text-xs text-fg-muted">{t('peaks.ai.reading')}</p>}
      {aiMsg && <Alert tone={aiMsg.tone}>{aiMsg.text}</Alert>}

      {editing !== null && (
        <form
          id={formId}
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface-muted p-3"
        >
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label={t('peaks.columns.peak')} className="col-span-2 sm:col-span-1">
              <Input
                value={row.peakName}
                onChange={(e) => setRow((f) => ({ ...f, peakName: e.target.value }))}
              />
            </FormField>
            {FIELDS.map((k) => (
              <FormField
                key={k}
                label={t(`peaks.fields.${k}`)}
                required={k === 'retentionTime'}
                error={fieldError(k)}
              >
                <Input
                  inputMode="decimal"
                  value={row[k]}
                  invalid={Boolean(errors[k])}
                  onChange={(e) => setRow((f) => ({ ...f, [k]: e.target.value }))}
                />
              </FormField>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={save.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        rows={results}
        rowKey={(r) => r.id}
        caption={t('peaks.tabs.results')}
        emptyText={t('peaks.empty')}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={t('peaks.confirmTitle')}
        description={t('peaks.confirmText', { count: drafts.length })}
        tone="primary"
        confirmLabel={t('peaks.confirm')}
        loading={confirm.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          confirm.mutate(undefined, {
            onSuccess: (r) => {
              setConfirmOpen(false);
              notify.success(t('peaks.confirmed', { count: r.confirmed }));
            },
          })
        }
      />
    </div>
  );
}
