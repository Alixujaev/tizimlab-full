import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleType } from '@/types';

interface SampleTypeBadgeProps {
  type: SampleType;
  className?: string;
}

export const SampleTypeBadge: React.FC<SampleTypeBadgeProps> = ({ type, className = '' }) => {
  const { t } = useTranslation();

  const config: Record<SampleType, { bg: string; text: string; labelKey: string }> = {
    raw_material: {
      bg: 'bg-teal-50 border-teal-200',
      text: 'text-teal-700',
      labelKey: 'samples.types.raw_material',
    },
    finished_product: {
      bg: 'bg-indigo-50 border-indigo-200',
      text: 'text-indigo-700',
      labelKey: 'samples.types.finished_product',
    },
    reagent: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      labelKey: 'samples.types.reagent',
    },
    standard_substance: {
      bg: 'bg-violet-50 border-violet-200',
      text: 'text-violet-700',
      labelKey: 'samples.types.standard_substance',
    },
    other: {
      bg: 'bg-slate-100 border-slate-200',
      text: 'text-slate-700',
      labelKey: 'samples.types.other',
    },
  };

  const { bg, text, labelKey } = config[type] ?? {
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-700',
    labelKey: type,
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${bg} ${text} ${className}`}
    >
      {t(labelKey, type)}
    </span>
  );
};
