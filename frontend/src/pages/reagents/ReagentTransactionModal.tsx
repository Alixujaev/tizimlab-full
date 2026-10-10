import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useCreateTransactionMutation } from '@/hooks/useReagents';
import type { ReagentDto, ReagentTransactionType } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  reagent: ReagentDto;
}

export function ReagentTransactionModal({ open, onClose, reagent }: Props) {
  const { t } = useTranslation();
  const createMutation = useCreateTransactionMutation();

  const [type, setType] = useState<ReagentTransactionType>('out');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [protocolId, setProtocolId] = useState('');
  const [analysisPurpose, setAnalysisPurpose] = useState('');
  const [recordedDate, setRecordedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError(t('reagents.errors.qtyPositive', "Miqdor 0 dan katta bo'lishi shart"));
      return;
    }

    if ((type === 'out' || type === 'disposal') && qty > reagent.quantity) {
      setError(
        t(
          'reagents.errors.insufficientStock',
          "Mavjud zaxiradan ko'p chiqim qilib bo'lmaydi",
        ),
      );
      return;
    }

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error', 'Xatolik yuz berdi');
      setError(msg);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('reagents.newTransaction')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-sm">
          <div className="font-semibold text-slate-800">{reagent.name}</div>
          <div className="text-slate-600">
            {t('reagents.currentStockLabel', 'Joriy zaxira:')}{' '}
            <span className="font-bold text-slate-900">
              {reagent.quantity} {reagent.unit}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.transactionType')} *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReagentTransactionType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="out">{t('reagents.types.out')}</option>
            <option value="in">{t('reagents.types.in')}</option>
            <option value="adjustment">{t('reagents.types.adjustment')}</option>
            <option value="disposal">{t('reagents.types.disposal')}</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.amount', 'Miqdor')} {`(${reagent.unit})`} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.recordedDate')} *
            </label>
            <input
              type="date"
              required
              value={recordedDate}
              onChange={(e) => setRecordedDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {type === 'out' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.analysisPurpose')}
            </label>
            <input
              type="text"
              value={analysisPurpose}
              onChange={(e) => setAnalysisPurpose(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.protocolId')}
          </label>
          <input
            type="text"
            value={protocolId}
            onChange={(e) => setProtocolId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.note')}
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {createMutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            {t('common.save', 'Saqlash')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
