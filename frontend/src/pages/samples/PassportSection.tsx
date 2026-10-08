import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleDetailDto } from '@/types';

interface PassportSectionProps {
  sample: SampleDetailDto;
}

export const PassportSection: React.FC<PassportSectionProps> = ({ sample }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">
          {t('samples.passportTitle', 'Namuna pasporti')}
        </h3>
        {sample.passportStatus ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {t(`samples.passportStatus.${sample.passportStatus}`, sample.passportStatus)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            {t('samples.noPassport', 'Pasport biriktirilmagan')}
          </span>
        )}
      </div>

      <div className="mt-4">
        {sample.passportFileName ? (
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📄</span>
              <span className="text-sm font-medium text-slate-700">
                {sample.passportFileName}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            <p className="text-xs text-slate-500">
              {t(
                'samples.passportPlaceholderNotice',
                'Pasport faylini yuklash va tezlashtirilgan tasdiqlash imkoniyati P4b bosqichida to‘liq ulanadi.',
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
