import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleStatus } from '@/types';

interface SampleStatusBadgeProps {
  status: SampleStatus;
  className?: string;
}

export const SampleStatusBadge: React.FC<SampleStatusBadgeProps> = ({ status, className = '' }) => {
  const { t } = useTranslation();

  const config: Record<SampleStatus, { bg: string; text: string; labelKey: string }> = {
    pending_assignment: {
      bg: 'bg-amber-100 border-amber-200',
      text: 'text-amber-800',
      labelKey: 'samples.status.pending_assignment',
    },
    in_progress: {
      bg: 'bg-blue-100 border-blue-200',
      text: 'text-blue-800',
      labelKey: 'samples.status.in_progress',
    },
    stopped: {
      bg: 'bg-rose-100 border-rose-200',
      text: 'text-rose-800',
      labelKey: 'samples.status.stopped',
    },
    submitted: {
      bg: 'bg-purple-100 border-purple-200',
      text: 'text-purple-800',
      labelKey: 'samples.status.submitted',
    },
    approved: {
      bg: 'bg-emerald-100 border-emerald-200',
      text: 'text-emerald-800',
      labelKey: 'samples.status.approved',
    },
    rejected: {
      bg: 'bg-red-100 border-red-200',
      text: 'text-red-800',
      labelKey: 'samples.status.rejected',
    },
  };

  const { bg, text, labelKey } = config[status] ?? {
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-800',
    labelKey: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bg} ${text} ${className}`}
    >
      {t(labelKey, status)}
    </span>
  );
};
