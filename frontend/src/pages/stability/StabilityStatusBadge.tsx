import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  StabilityCheckpointStatus,
  StabilityResultStatus,
  StabilityStudyStatus,
} from '@/types';

export const StudyStatusBadge: React.FC<{ status: StabilityStudyStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const isCompleted = status === 'completed';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isCompleted
          ? 'bg-slate-100 text-slate-800 border border-slate-200'
          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      }`}
    >
      {isCompleted ? t('stability.completed') : t('stability.active')}
    </span>
  );
};

export const CheckpointStatusBadge: React.FC<{
  status: StabilityCheckpointStatus;
  isDueSoon?: boolean;
}> = ({ status, isDueSoon }) => {
  const { t } = useTranslation();

  const styles: Record<StabilityCheckpointStatus, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    overdue: 'bg-rose-100 text-rose-800 border-rose-200 font-semibold',
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
          styles[status]
        }`}
      >
        {t(`stability.${status}`)}
      </span>
      {isDueSoon && status !== 'completed' && status !== 'overdue' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-300 animate-pulse">
          {t('stability.dueSoon')}
        </span>
      )}
    </div>
  );
};

export const ResultStatusBadge: React.FC<{ status: StabilityResultStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const styles: Record<StabilityResultStatus, string> = {
    pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    fail: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
        styles[status]
      }`}
    >
      {t(`stability.${status}`)}
    </span>
  );
};
