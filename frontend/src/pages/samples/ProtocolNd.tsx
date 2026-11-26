import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsumptionsQuery, useNdListQuery, useReviewConsumptionMutation } from '@/hooks/useP17';
import { errorMessage } from '@/lib/queryClient';
import type { ConsumptionDto, ConsumptionStatus } from '@/types/p17';
import {
  Alert,
  Button,
  DataTable,
  type DataTableColumn,
  FormField,
  Input,
  Modal,
  notify,
  Select,
  StatusPill,
  Textarea,
  type Tone,
} from '@/ui';

/**
 * D-177: yuborishdan oldin tahlil bajarilgan ND (faqat tasdiqlanganlar) va tahlillar soni.
 * ND tanlanmasa sarf yozilmaydi (avvalgi oqim).
 */
export function ProtocolNdSelect({
  ndId,
  nAnalyses,
  onChange,
}: {
  ndId: string;
  nAnalyses: string;
  onChange: (v: { ndId: string; nAnalyses: string }) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useNdListQuery({ status: 'approved', limit: 100 });
  return (
    <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
      <FormField
        id="protocol-nd"
        label={t('protocols.nd.label')}
        hint={t('protocols.nd.hint')}
        className="w-full sm:w-72"
      >
        <Select
          disabled={isLoading}
          options={[
            { value: '', label: t('protocols.nd.none') },
            ...(data?.data ?? []).map((nd) => ({
              value: nd.id,
              label: `${nd.code}${nd.version ? ` (${nd.version})` : ''} — ${nd.name}`,
            })),
          ]}
          value={ndId}
          onChange={(v) => onChange({ ndId: v, nAnalyses })}
        />
      </FormField>
      {ndId && (
        <FormField id="protocol-n" label={t('protocols.nd.analyses')} className="w-28">
          <Input
            type="number"
            min="1"
            max="100"
            value={nAnalyses}
            onChange={(e) => onChange({ ndId, nAnalyses: e.target.value })}
          />
        </FormField>
      )}
    </div>
  );
}

const TONE: Record<ConsumptionStatus, Tone> = {
  auto: 'warning',
  confirmed: 'success',
  corrected: 'info',
};

function CorrectModal({
  item,
  protocolId,
  onClose,
}: {
  item: ConsumptionDto | null;
  protocolId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const review = useReviewConsumptionMutation(protocolId);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const q = Number(qty);
    if (qty.trim() === '' || Number.isNaN(q) || q < 0)
      return setError(t('protocols.consumption.qtyInvalid'));
    if (reason.trim().length < 5) return setError(t('protocols.consumption.reasonMin'));
    try {
      await review.mutateAsync({ id: item.id, correct: { quantity: q, reason: reason.trim() } });
      setQty('');
      setReason('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={t('protocols.consumption.correctTitle', { name: item?.reagentItemName ?? '' })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={review.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField
          id="consumption-qty"
          label={t('protocols.consumption.newQty', { unit: item?.unit ?? '' })}
          hint={t('protocols.consumption.newQtyHint', {
            qty: item?.consumedQty ?? 0,
            unit: item?.unit ?? '',
          })}
          required
        >
          <Input
            type="number"
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </FormField>
        <FormField id="consumption-reason" label={t('protocols.consumption.reason')} required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}

/** D-177: tahlil bo'yicha avto-sarf, lotlar (FEFO) va tasdiqlash/tuzatish. */
export function ProtocolConsumptions({
  protocolId,
  canReview,
}: {
  protocolId: string;
  canReview: boolean;
}) {
  const { t } = useTranslation();
  const { data = [] } = useConsumptionsQuery(protocolId);
  const review = useReviewConsumptionMutation(protocolId);
  const [correcting, setCorrecting] = useState<ConsumptionDto | null>(null);
  if (data.length === 0) return null;

  const columns: DataTableColumn<ConsumptionDto>[] = [
    {
      key: 'reagent',
      header: t('protocols.consumption.reagent'),
      primary: true,
      render: (c) => (
        <div className="min-w-0">
          <span className="font-medium text-fg">{c.reagentItemName}</span>
          {c.lots.length > 0 && (
            <div className="text-xs text-fg-muted">
              {c.lots.map((l) => `${l.reagentName}: ${l.quantity} ${l.unit}`).join('; ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'qty',
      header: t('protocols.consumption.consumed'),
      render: (c) => (
        <span className="tabular-nums">
          {t('protocols.consumption.qtyLine', {
            consumed: c.consumedQty,
            required: c.requiredQty,
            unit: c.unit,
          })}
          {c.shortfallQty > 0 && (
            <span className="block text-xs font-medium text-danger-fg">
              {t('protocols.consumption.shortfall', { qty: c.shortfallQty, unit: c.unit })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (c) => (
        <StatusPill tone={TONE[c.status]}>
          {t(`protocols.consumption.status.${c.status}`)}
        </StatusPill>
      ),
    },
    ...(canReview
      ? [
          {
            key: 'actions',
            header: t('common.actions'),
            align: 'right' as const,
            render: (c: ConsumptionDto) => (
              <div className="flex flex-wrap justify-end gap-1">
                {c.status === 'auto' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={review.isPending}
                    onClick={() =>
                      review.mutate(
                        { id: c.id },
                        { onError: (err) => notify.error(errorMessage(err)) },
                      )
                    }
                  >
                    {t('protocols.consumption.confirm')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setCorrecting(c)}>
                  {t('protocols.consumption.correct')}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const anyShortfall = data.some((c) => c.shortfallQty > 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <h3 className="text-sm font-semibold text-fg">{t('protocols.consumption.title')}</h3>
      {anyShortfall && <Alert tone="warning">{t('protocols.consumption.shortfallNotice')}</Alert>}
      <DataTable
        caption={t('protocols.consumption.title')}
        columns={columns}
        rows={data}
        rowKey={(c) => c.id}
      />
      <CorrectModal item={correcting} protocolId={protocolId} onClose={() => setCorrecting(null)} />
    </div>
  );
}
