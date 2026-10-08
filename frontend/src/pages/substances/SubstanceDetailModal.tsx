import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useSubstanceQuery } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';

interface SubstanceDetailModalProps {
  open: boolean;
  onClose: () => void;
  substanceId: string | null;
}

export function SubstanceDetailModal({
  open,
  onClose,
  substanceId,
}: SubstanceDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { data: substance, isLoading } = useSubstanceQuery(substanceId ?? '');

  if (!open || !substanceId) return null;

  const currentName = substance ? getSubstanceName(substance, i18n.language) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentName || t('substances.detailTitle', 'Modda tafsilotlari')}
    >
      {isLoading || !substance ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Asosiy ma'lumotlar kartochkasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
            <div>
              <span className="block text-xs font-medium text-slate-500">
                {t('substances.nameUz', 'Nomi (O‘zbekcha)')}
              </span>
              <span className="font-semibold text-slate-900">{substance.nameUz}</span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">
                {t('substances.nameRu', 'Nomi (Ruscha)')}
              </span>
              <span className="text-slate-800">{substance.nameRu || '—'}</span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">
                {t('substances.nameEn', 'Nomi (Inglizcha)')}
              </span>
              <span className="text-slate-800">{substance.nameEn || '—'}</span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">
                {t('substances.pharmacopoeia', 'Farmakopiya')}
              </span>
              <span className="inline-block mt-0.5 px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                {substance.pharmacopoeia}
              </span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">
                {t('substances.casNumber', 'CAS raqami')}
              </span>
              <span className="text-slate-800 font-mono">{substance.casNumber || '—'}</span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">
                {t('common.status', 'Holati')}
              </span>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 text-xs font-medium rounded ${
                  substance.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {substance.isActive ? t('common.active', 'Faol') : t('common.inactive', 'Nofaol')}
              </span>
            </div>

            {substance.description && (
              <div className="sm:col-span-2 md:col-span-3">
                <span className="block text-xs font-medium text-slate-500">
                  {t('substances.description', 'Tavsif')}
                </span>
                <span className="text-slate-700">{substance.description}</span>
              </div>
            )}
          </div>

          {/* Parametrlar ro'yxati */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              {t('substances.parameters', 'Modda parametrlari')}{' '}
              <span className="text-slate-500 font-normal">
                ({substance.parameters?.length ?? 0})
              </span>
            </h4>

            {(!substance.parameters || substance.parameters.length === 0) ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-200 text-center">
                {t('substances.noParameters', 'Ushbu moddaga parametrlar kiritilmagan')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-medium">
                    <tr>
                      <th className="px-3 py-2 w-12">#</th>
                      <th className="px-3 py-2">{t('substances.parameterName', 'Parametr nomi')}</th>
                      <th className="px-3 py-2">{t('substances.specMin', 'Min chegara')}</th>
                      <th className="px-3 py-2">{t('substances.specMax', 'Max chegara')}</th>
                      <th className="px-3 py-2">{t('substances.unit', 'Birlik')}</th>
                      <th className="px-3 py-2">{t('substances.method', 'Tahlil metodi')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {substance.parameters.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{p.parameterName}</td>
                        <td className="px-3 py-2 text-slate-700">{p.specMin !== null ? p.specMin : '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{p.specMax !== null ? p.specMax : '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{p.unit || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{p.method || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('common.close', 'Yopish')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
