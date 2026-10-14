import { useTranslation } from 'react-i18next';
import type { ReagentDto } from '@/types';
import { StatusPill } from '@/ui';

/** Reaktiv holati belgilari (ro'yxat va tafsilotda bir xil). */
export function ReagentStatusBadges({ reagent }: { reagent: ReagentDto }) {
  const { t } = useTranslation();
  const ok = !reagent.isLowStock && !reagent.isExpired && !reagent.isHazardous;
  return (
    <div className="flex flex-wrap gap-1">
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
