import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/types';
import { ButtonLink } from '@/ui';
import { SampleStatusSection } from './SampleStatusSection';

/** D-33, P14: kimyogar — o'ziga biriktirilgan namunalar statuslar bo'yicha va protokol yuborish tez yo'li. */
export function ChemistDashboard({ data }: { data: Extract<DashboardDto, { view: 'chemist' }> }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-line bg-surface-muted">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-fg truncate">
            {t('dashboard.quickProtocolAction', 'Protokol yuklash va yuborish')}
          </span>
          <span className="text-xs text-fg-muted truncate">
            {t('dashboard.assignedSamplesDesc', "Jarayondagi namunalar bo'yicha tahlil natijasini kiritish")}
          </span>
        </div>
        <ButtonLink
          to="/samples"
          variant="primary"
          size="md"
          leftIcon="upload"
          className="shrink-0"
        >
          <span>{t('dashboard.openSamples', 'Namunalar')}</span>
        </ButtonLink>
      </div>

      <SampleStatusSection
        titleKey="dashboard.assignedSamples"
        counts={data.samplesByStatus}
        total={data.totalSamples}
      />
    </div>
  );
}
