import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { useResolveAlertMutation } from '@/hooks/useTemperature';
import type { TemperatureAlertDto } from '@/types';

interface ResolveAlertModalProps {
  open: boolean;
  onClose: () => void;
  alert: TemperatureAlertDto | null;
}

export function ResolveAlertModal({ open, onClose, alert }: ResolveAlertModalProps) {
  const { t } = useTranslation();
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useResolveAlertMutation();

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert) return;
    setError(null);

    try {
      await mutation.mutateAsync({
        id: alert.id,
        input: { resolutionNote: resolutionNote.trim() || null },
      });
      setResolutionNote('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    }
  };

  if (!alert) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('temperature.resolve')}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('temperature.cancel')}
          </button>
          <button
            type="submit"
            form="resolve-alert-form"
            disabled={mutation.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {mutation.isPending ? t('common.saving') : t('temperature.resolve')}
          </button>
        </div>
      }
    >
      <form id="resolve-alert-form" onSubmit={handleResolve} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
          <p className="font-semibold">
            <span>{alert.locationName}</span> <span className="ml-1">({alert.sensorId})</span>
          </p>
          <p className="mt-1">
            <span className="mr-1">{t('temperature.temperature')}:</span>
            <span>{alert.temperature} {t('temperature.tempUnit')}</span>
            <span className="mx-2">&ndash;</span>
            <span className="font-medium">{alert.alertType}</span>
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {new Date(alert.createdAt).toLocaleString()}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t('temperature.resolutionNote')}
          </label>
          <textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
}
