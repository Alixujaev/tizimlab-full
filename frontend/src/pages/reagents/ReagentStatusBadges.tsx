import { useTranslation } from 'react-i18next';
import type { ReagentDto } from '@/types';
import { StatusPill } from '@/ui';

/** Reaktiv holati belgilari (ro'yxat va tafsilotda bir xil). */
export function ReagentStatusBadges({ reagent }: { reagent: ReagentDto }) {
  const { t } = useTranslation();
  const approval = reagent.approvalStatus ?? 'approved';
  const ok =
    approval === 'approved' && !reagent.isLowStock && !reagent.isExpired && !reagent.isHazardous;
  return (
    <div className="flex flex-wrap gap-1">
      {approval === 'pending' && (
        <StatusPill tone="warning">{t('reagents.approval.pending', 'Tasdiq kutilmoqda')}</StatusPill>
      )}
      {approval === 'rejected' && (
        <StatusPill tone="danger">{t('reagents.approval.rejected', 'Rad etilgan')}</StatusPill>
      )}
      {reagent.isLowStock && (
        <StatusPill tone="warning">{t('reagents.lowStock', 'Kam qoldi')}</StatusPill>
      )}
      {reagent.isExpired && (
        <StatusPill tone="danger">{t('reagents.expired', "Muddati o'tgan")}</StatusPill>
      )}
      {reagent.isHazardous && (
        <StatusPill tone="accent">{t('reagents.hazardous', 'Xavfli')}</StatusPill>
      )}
      {ok && <StatusPill tone="success">{t('reagents.normal', 'Normal')}</StatusPill>}
    </div>
  );
}
