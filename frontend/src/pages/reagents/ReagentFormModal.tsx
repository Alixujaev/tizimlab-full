import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  useCreateReagentMutation,
  useUpdateReagentMutation,
} from '@/hooks/useReagents';
import type { ReagentDto } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  reagent?: ReagentDto | null;
}

export function ReagentFormModal({ open, onClose, reagent }: Props) {
  const { t } = useTranslation();
  const createMutation = useCreateReagentMutation();
  const updateMutation = useUpdateReagentMutation();

  const isEditing = Boolean(reagent);

  const [name, setName] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [unit, setUnit] = useState('g');
  const [quantity, setQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [supplier, setSupplier] = useState('');
  const [storageConditions, setStorageConditions] = useState('');
  const [isHazardous, setIsHazardous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reagent) {
      setName(reagent.name);
      setCasNumber(reagent.casNumber ?? '');
      setUnit(reagent.unit);
      setQuantity(String(reagent.quantity));
      setLowStockThreshold(String(reagent.lowStockThreshold));
      setExpiresAt(reagent.expiresAt ?? '');
      setSupplier(reagent.supplier ?? '');
      setStorageConditions(reagent.storageConditions ?? '');
      setIsHazardous(reagent.isHazardous);
    } else {
      setName('');
      setCasNumber('');
      setUnit('g');
      setQuantity('0');
      setLowStockThreshold('0');
      setExpiresAt('');
      setSupplier('');
      setStorageConditions('');
      setIsHazardous(false);
    }
    setError(null);
  }, [reagent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('reagents.nameRequired', 'Reaktiv nomi kiritilishi shart'));
      return;
    }
    if (!unit.trim()) {
      setError(t('reagents.unitRequired', "O'lchov birligi kiritilishi shart"));
      return;
    }

    try {
      if (isEditing && reagent) {
        await updateMutation.mutateAsync({
          id: reagent.id,
          input: {
            name: name.trim(),
            casNumber: casNumber.trim() || null,
            unit: unit.trim(),
            lowStockThreshold: Number(lowStockThreshold) || 0,
            expiresAt: expiresAt || null,
            supplier: supplier.trim() || null,
            storageConditions: storageConditions.trim() || null,
            isHazardous,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          casNumber: casNumber.trim() || null,
          unit: unit.trim(),
          quantity: Number(quantity) || 0,
          lowStockThreshold: Number(lowStockThreshold) || 0,
          expiresAt: expiresAt || null,
          supplier: supplier.trim() || null,
          storageConditions: storageConditions.trim() || null,
          isHazardous,
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error', 'Xatolik yuz berdi');
      setError(msg);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('reagents.edit') : t('reagents.create')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.name')} *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.casNumber')}
            </label>
            <input
              type="text"
              value={casNumber}
              onChange={(e) => setCasNumber(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.unit')} *
            </label>
            <input
              type="text"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t('reagents.quantity')}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.lowStockThreshold')}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.expiresAt')}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t('reagents.supplier')}
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.storageConditions')}
          </label>
          <input
            type="text"
            value={storageConditions}
            onChange={(e) => setStorageConditions(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isHazardous"
            checked={isHazardous}
            onChange={(e) => setIsHazardous(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="isHazardous" className="text-sm font-medium text-slate-700">
            {t('reagents.isHazardous')}
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending && <Spinner className="h-4 w-4 text-white" />}
            {t('common.save', 'Saqlash')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
