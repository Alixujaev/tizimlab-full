import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/types';
import { ButtonLink, StatCard } from '@/ui';
import { SampleStatusSection } from './SampleStatusSection';

/** D-33, Q-65, P14: kontrolyor (Inspector) — o'zi yaratgan namunalar, yangi namuna tez yo'li va kutayotgan pasportlar. */
export function InspectorDashboard({
  data,
}: {
  data: Extract<DashboardDto, { view: 'inspector' }>;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-line bg-surface-muted">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-fg truncate">
            {t('dashboard.registerSample', 'Yangi namuna kiritish')}
          </span>
          <span className="text-xs text-fg-muted truncate">
            {t('dashboard.registerSampleDesc', "Laboratoriyaga kelib tushgan yangi namunani ro'yxatga olish")}
          </span>
        </div>
        <ButtonLink
          to="/samples"
          variant="primary"
          size="md"
          leftIcon="plus"
          className="shrink-0"
        >
          <span>{t('dashboard.newSample', 'Kiritish')}</span>
        </ButtonLink>
      </div>

      {(data.samplesByStatus.pending_assignment ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            label={t('dashboard.pendingAssignment', 'Kutayotgan namunalar')}
            value={data.samplesByStatus.pending_assignment}
            to="/samples?status=pending_assignment"
            icon="clock"
            tone="warning"
            highlight={true}
          />
        </div>
      )}

      <SampleStatusSection
        titleKey="dashboard.mySamples"
        counts={data.samplesByStatus}
        total={data.totalSamples}
      />
    </div>
  );
}
