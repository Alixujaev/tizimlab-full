import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { useRegistryItemQuery } from '@/hooks/useRegistry';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import { SampleTrackingTimeline } from '../samples/SampleTrackingTimeline';
import { SampleTypeBadge } from '../samples/SampleTypeBadge';
import { RegistryDeleteModal } from './RegistryDeleteModal';
import { canDeleteFromRegistry, downloadRegistryFile } from './registryActions';

export const RegistryDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { data: item, isLoading, isError } = useRegistryItemQuery(id);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const back = (
    <Link to="/registry" className="text-xs font-medium text-slate-500 hover:text-slate-800">
      ← {t('registry.backToList')}
    </Link>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="py-12 text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">{t('registry.notFound')}</h1>
        {back}
      </div>
    );
  }

  const fields: [string, React.ReactNode][] = [
    [t('registry.columns.type'), <SampleTypeBadge key="type" type={item.type} />],
    [t('registry.columns.serialNumber'), item.serialNumber ?? '—'],
    [t('registry.columns.lotNumber'), item.lotNumber ?? '—'],
    [t('samples.quantity'), item.quantity ?? '—'],
    [t('samples.manufacturer'), item.manufacturer ?? '—'],
    [t('registry.columns.approvedAt'), formatDate(item.approvedAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {back}
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{item.substanceName}</h1>
          <p className="text-sm text-slate-500">{t('pages.registryDetail')}</p>
        </div>
        <div className="flex gap-2">
          {item.downloadKind && (
            <button
              type="button"
              onClick={() => void downloadRegistryFile(item.id)}
              className="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 bg-white hover:bg-slate-50"
            >
              {item.downloadKind === 'passport'
                ? t('registry.downloadPassport')
                : t('registry.downloadProtocol')}
            </button>
          )}
          {canDeleteFromRegistry(role) && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="px-3 py-1.5 text-sm font-medium rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              {t('registry.delete')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <dl className="lg:col-span-2 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="mt-1 text-sm text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 border-b border-slate-100 pb-4 text-base font-semibold text-slate-900">
            {t('samples.timelineTitle')}
          </h2>
          <SampleTrackingTimeline tracking={item.tracking} />
        </div>
      </div>

      <RegistryDeleteModal
        sample={deleteOpen ? item : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => void navigate('/registry')}
      />
    </div>
  );
};
