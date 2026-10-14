import { useTranslation } from 'react-i18next';
import type { SampleStatus } from '@/types';
import { StatusPill, type Tone } from '@/ui';

/** Namuna holati → ohang (butun ilovada bir xil). */
export const SAMPLE_STATUS_TONE: Record<SampleStatus, Tone> = {
  pending_assignment: 'warning',
  in_progress: 'info',
  stopped: 'neutral',
  submitted: 'accent',
  approved: 'success',
  rejected: 'danger',
};

interface SampleStatusBadgeProps {
  status: SampleStatus;
  className?: string;
}

export function SampleStatusBadge({ status, className }: SampleStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <StatusPill
      tone={SAMPLE_STATUS_TONE[status] ?? 'neutral'}
      pulse={status === 'in_progress'}
      className={className}
    >
      {t(`samples.status.${status}`, status)}
    </StatusPill>
  );
}
