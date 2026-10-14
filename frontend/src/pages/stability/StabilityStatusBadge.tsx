import { useTranslation } from 'react-i18next';
import type {
  StabilityCheckpointStatus,
  StabilityResultStatus,
  StabilityStudyStatus,
} from '@/types';
import { Badge, StatusPill, type Tone } from '@/ui';

export function StudyStatusBadge({ status }: { status: StabilityStudyStatus }) {
  const { t } = useTranslation();
  return status === 'completed' ? (
    <StatusPill tone="neutral">{t('stability.completed')}</StatusPill>
  ) : (
    <StatusPill tone="success">{t('stability.active')}</StatusPill>
  );
}

const CHECKPOINT_TONE: Record<StabilityCheckpointStatus, Tone> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  overdue: 'danger',
};

export function CheckpointStatusBadge({
  status,
  isDueSoon,
}: {
  status: StabilityCheckpointStatus;
  isDueSoon?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusPill tone={CHECKPOINT_TONE[status]} pulse={status === 'in_progress'}>
        {t(`stability.${status}`)}
      </StatusPill>
      {isDueSoon && status !== 'completed' && status !== 'overdue' && (
        <Badge tone="warning" size="sm" icon="clock">
          {t('stability.dueSoon')}
        </Badge>
      )}
    </span>
  );
}

const RESULT_TONE: Record<StabilityResultStatus, Tone> = {
  pass: 'success',
  warning: 'warning',
  fail: 'danger',
};

export function ResultStatusBadge({ status }: { status: StabilityResultStatus }) {
  const { t } = useTranslation();
  return <Badge tone={RESULT_TONE[status]}>{t(`stability.${status}`)}</Badge>;
}
