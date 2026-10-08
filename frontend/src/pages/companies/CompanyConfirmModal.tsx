import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import type { CompanyDto } from '@/types';

interface CompanyConfirmModalProps {
  open: boolean;
  onClose: () => void;
  company: CompanyDto | null;
  action: 'activate' | 'deactivate' | null;
  onConfirm: () => void;
  loading: boolean;
}

export function CompanyConfirmModal({
  open,
  onClose,
  company,
  action,
  onConfirm,
  loading,
}: CompanyConfirmModalProps) {
  const { t } = useTranslation();

  if (!company || !action) return null;

  const isDeactivate = action === 'deactivate';
  const title = isDeactivate
    ? t('companies.confirmDeactivateTitle')
    : t('companies.confirmActivateTitle');
  const description = isDeactivate
    ? t('companies.confirmDeactivateText')
    : t('companies.confirmActivateText');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('companies.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              isDeactivate
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
            }`}
          >
            {loading && <Spinner size="sm" />}
            {t('companies.confirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-900">{company.name}</p>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </Modal>
  );
}
