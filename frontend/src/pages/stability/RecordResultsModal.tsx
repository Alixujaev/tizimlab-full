import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecordResultsMutation } from '@/hooks/useStability';
import { formatDate } from '@/lib/date';
import { errorMessage } from '@/lib/queryClient';
import type { StabilityCheckpointDto, StabilityResultStatus } from '@/types';
import { Alert, Button, DataTable, type DataTableColumn, Input, Modal, Select } from '@/ui';

interface RecordResultsModalProps {
  studyId: string;
  checkpoint: StabilityCheckpointDto;
  isOpen: boolean;
  onClose: () => void;
}

interface ResultRow {
  id: string;
  parameter: string;
  initialValue: string | null;
  currentValue: string;
  specification: string;
  resultStatus: StabilityResultStatus;
}

const STATUSES: StabilityResultStatus[] = ['pass', 'warning', 'fail'];

export function RecordResultsModal({
  studyId,
  checkpoint,
  isOpen,
  onClose,
}: RecordResultsModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useRecordResultsMutation(studyId);
  const [results, setResults] = useState<ResultRow[]>(() =>
    (checkpoint.results ?? []).map((r) => ({
      id: r.id,
      parameter: r.parameter,
      initialValue: r.initialValue,
      currentValue: r.currentValue ?? '',
      specification: r.specification ?? '',
      resultStatus: r.resultStatus ?? 'pass',
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const update = <K extends 'currentValue' | 'specification' | 'resultStatus'>(
    index: number,
    field: K,
    value: ResultRow[K],
  ) => setResults((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!results.some((r) => r.currentValue.trim() !== '')) {
      setError(t('stability.currentValueRequired', 'Kamida bitta parametr qiymatini kiriting'));
      return;
    }
    try {
      await mutation.mutateAsync({
        checkpointId: checkpoint.id,
        input: {
          results: results
            .filter((r) => r.currentValue.trim() !== '')
            .map((r) => ({
              id: r.id,
              parameter: r.parameter,
              currentValue: r.currentValue,
              specification: r.specification || null,
              resultStatus: r.resultStatus,
            })),
        },
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const columns: DataTableColumn<ResultRow>[] = [
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
      render: (r) => (
        <Input
          size="sm"
          aria-label={`${r.parameter} — ${t('stability.currentValue')}`}
          value={r.currentValue}
          onChange={(e) => update(results.indexOf(r), 'currentValue', e.target.value)}
          placeholder={t('stability.resultPlaceholder')}
        />
      ),
    },
    {
      key: 'spec',
      header: t('stability.specification'),
      render: (r) => (
        <Input
          size="sm"
          aria-label={`${r.parameter} — ${t('stability.specification')}`}
          value={r.specification}
          onChange={(e) => update(results.indexOf(r), 'specification', e.target.value)}
          placeholder={t('stability.specPlaceholder')}
        />
      ),
    },
    {
      key: 'status',
      header: t('stability.resultStatus'),
      render: (r) => (
        <Select
          size="sm"
          aria-label={`${r.parameter} — ${t('stability.resultStatus')}`}
          options={STATUSES.map((s) => ({ value: s, label: t(`stability.${s}`) }))}
          value={r.resultStatus}
          onChange={(v) => update(results.indexOf(r), 'resultStatus', v)}
        />
      ),
    },
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      title={`${t('stability.recordResults')} — ${checkpoint.intervalTag}`}
      description={`${t('stability.dueDate')}: ${formatDate(checkpoint.dueDate)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('stability.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {t('stability.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <DataTable columns={columns} rows={results} rowKey={(r) => r.parameter} />
      </form>
    </Modal>
  );
}
