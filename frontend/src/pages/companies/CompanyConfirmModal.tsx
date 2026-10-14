import { useTranslation } from 'react-i18next';
import type { CompanyDto } from '@/types';
import { ConfirmDialog } from '@/ui';

interface CompanyConfirmModalProps {
  open: boolean;
  onClose: () => void;
  company: CompanyDto | null;
  action: 'activate' | 'deactivate' | null;
  onConfirm: () => void;
  loading: boolean;
}

/** Kompaniyani faollashtirish/nofaollashtirish tasdig'i (nofaollashtirish — xavfli amal). */
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
  return (
    <ConfirmDialog
      open={open}
      tone={isDeactivate ? 'danger' : 'primary'}
      title={
        isDeactivate ? t('companies.confirmDeactivateTitle') : t('companies.confirmActivateTitle')
      }
      description={
        isDeactivate ? t('companies.confirmDeactivateText') : t('companies.confirmActivateText')
      }
      confirmLabel={t('companies.confirm')}
      cancelLabel={t('companies.cancel')}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onClose}
    >
      <p className="text-sm font-medium text-fg">{company.name}</p>
    </ConfirmDialog>
  );
}
