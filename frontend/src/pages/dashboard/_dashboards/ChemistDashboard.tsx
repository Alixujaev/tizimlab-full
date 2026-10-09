import type { DashboardDto } from '@/types';
import { SampleStatusSection } from './SampleStatusSection';

/** D-33: kimyogar — o'ziga biriktirilgan namunalar statuslar bo'yicha. */
export function ChemistDashboard({ data }: { data: Extract<DashboardDto, { view: 'chemist' }> }) {
  return (
    <SampleStatusSection
      titleKey="dashboard.assignedSamples"
      counts={data.samplesByStatus}
      total={data.totalSamples}
    />
  );
}
