import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleDetailDto } from '@/types';

interface ProtocolSectionProps {
  sample: SampleDetailDto;
}

export const ProtocolSection: React.FC<ProtocolSectionProps> = ({ sample: _sample }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">
          {t('samples.protocolTitle', 'Tahlil protokoli')}
        </h3>
        <span className="text-xs text-slate-400">
          {t('samples.protocolStatusDraft', 'P5 bosqichida')}
        </span>
      </div>

      <div className="mt-4 text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
        <p className="text-xs text-slate-500">
          {t(
            'samples.protocolPlaceholderNotice',
            'Tahlil protokollarini avtomatik yaratish, fayl yuklash va tasdiqlash P5 bosqichida ulanadi.',
          )}
        </p>
      </div>
    </div>
  );
};
