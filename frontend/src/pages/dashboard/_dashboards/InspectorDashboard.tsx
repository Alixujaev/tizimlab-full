import type { DashboardDto } from '@/types';
import { SampleStatusSection } from './SampleStatusSection';

/** D-33, Q-65: kontrolyor (Inspector) — o'zi yaratgan namunalar. */
export function InspectorDashboard({
  data,
}: {
  data: Extract<DashboardDto, { view: 'inspector' }>;
}) {
  return (
    <SampleStatusSection
      titleKey="dashboard.mySamples"
      counts={data.samplesByStatus}
      total={data.totalSamples}
    />
  );
}
