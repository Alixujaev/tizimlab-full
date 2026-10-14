import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateTransactionMutation } from '@/hooks/useReagents';
import { errorMessage } from '@/lib/queryClient';
import type { ReagentDto, ReagentTransactionType } from '@/types';
import { Alert, Button, DatePicker, FormField, Input, Modal, Select, Textarea } from '@/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  reagent: ReagentDto;
}

const TYPES: ReagentTransactionType[] = ['out', 'in', 'adjustment', 'disposal'];
const today = () => new Date().toISOString().slice(0, 10);

export function ReagentTransactionModal({ open, onClose, reagent }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const createMutation = useCreateTransactionMutation();

  const [type, setType] = useState<ReagentTransactionType>('out');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [protocolId, setProtocolId] = useState('');
  const [analysisPurpose, setAnalysisPurpose] = useState('');
  const [recordedDate, setRecordedDate] = useState(today);
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setQtyError(t('reagents.errors.qtyPositive', "Miqdor 0 dan katta bo'lishi shart"));
      return;
    }
    if ((type === 'out' || type === 'disposal') && qty > reagent.quantity) {
      setQtyError(
        t('reagents.errors.insufficientStock', "Mavjud zaxiradan ko'p chiqim qilib bo'lmaydi"),
      );
      return;
    }
    setQtyError(null);
    try {
      await createMutation.mutateAsync({
        reagentId: reagent.id,
        input: {
          type,
          quantity: qty,
          note: note.trim() || null,
          protocolId: protocolId.trim() || null,
          analysisPurpose: analysisPurpose.trim() || null,
          recordedDate: recordedDate || null,
        },
      });
      setQuantity('');
      setNote('');
      setProtocolId('');
      setAnalysisPurpose('');
      setError(null);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('reagents.newTransaction')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createMutation.isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button type="submit" form={formId} loading={createMutation.isPending}>
            {t('common.save', 'Saqlash')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm">
          <span className="font-medium text-fg">{reagent.name}</span>
          <span className="text-fg-muted">
            {t('reagents.currentStockLabel', 'Joriy zaxira:')}{' '}
            <span className="font-semibold tabular-nums text-fg">
              {reagent.quantity} {reagent.unit}
            </span>
          </span>
        </div>

        <FormField label={t('reagents.transactionType')} required>
          <Select
            options={TYPES.map((v) => ({ value: v, label: t(`reagents.types.${v}`) }))}
            value={type}
            onChange={setType}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={`${t('reagents.amount', 'Miqdor')} (${reagent.unit})`}
            required
            error={qtyError}
          >
            <Input
              type="number"
              step="any"
              min="0.0001"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (qtyError) setQtyError(null);
              }}
            />
          </FormField>
          <FormField label={t('reagents.recordedDate')} required>
            <DatePicker value={recordedDate} onChange={setRecordedDate} />
          </FormField>
        </div>

        {type === 'out' && (
          <FormField label={t('reagents.analysisPurpose')}>
            <Input value={analysisPurpose} onChange={(e) => setAnalysisPurpose(e.target.value)} />
          </FormField>
        )}
        <FormField label={t('reagents.protocolId')}>
          <Input value={protocolId} onChange={(e) => setProtocolId(e.target.value)} />
        </FormField>
        <FormField label={t('reagents.note')}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
