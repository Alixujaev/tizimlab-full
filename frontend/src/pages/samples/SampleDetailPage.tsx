import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { useSampleQuery } from '@/hooks/useSamples';
import { useAuthStore } from '@/store/authStore';
import { PassportSection } from './PassportSection';
import { ProtocolSection } from './ProtocolSection';
import { SampleAssignModal } from './SampleAssignModal';
import { SampleResumeModal } from './SampleResumeModal';
import { SampleStatusBadge } from './SampleStatusBadge';
import { SampleStopModal } from './SampleStopModal';
import { SampleTrackingTimeline } from './SampleTrackingTimeline';
import { SampleTypeBadge } from './SampleTypeBadge';

export const SampleDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const { data: sample, isLoading, isError } = useSampleQuery(id ?? '');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !sample) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('samples.notFound', 'Namuna topilmadi')}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {t('samples.notFoundMessage', 'Siz qidirayotgan namuna mavjud emas yoki sizda uni ko‘rish huquqi yo‘q.')}
        </p>
        <div className="mt-6">
          <Link
            to="/samples"
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            ← {t('samples.backToList', 'Namunalar ro‘yxatiga qaytish')}
          </Link>
        </div>
      </div>
    );
  }

  // Rolga oid ruxsatlar (spec §1, §3)
  const isLabHead = user?.role === 'lab_head';
  const isAssignedChemist =
    user?.role === 'chemist' && Boolean(user?.id && sample.assignedTo === user.id);

  // Biriktirish qoidalari (R-PASS-23, D-37, D-39)
  const canAssign =
    isLabHead &&
    sample.type !== 'reagent' &&
    sample.type !== 'standard_substance' &&
    ['pending_assignment', 'in_progress', 'stopped', 'rejected'].includes(sample.status);

  // To'xtatish / Davom ettirish qoidalari (D-36, D-38)
  const canStop = isAssignedChemist && sample.status === 'in_progress';
  const canResume = isAssignedChemist && sample.status === 'stopped';

  return (
    <div className="space-y-6">
      {/* Yuqori navigatsiya va Sarlavha */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to="/samples"
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              ← {t('samples.backToList', 'Namunalar ro‘yxatiga qaytish')}
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {sample.substanceName}
            </h1>
            <SampleTypeBadge type={sample.type} />
            <SampleStatusBadge status={sample.status} />
          </div>
        </div>

        {/* Amallar paneli */}
        <div className="flex items-center gap-2 flex-wrap">
          {canAssign && (
            <button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              {sample.assignedTo
                ? t('samples.reassignChemist', 'Qayta biriktirish')
                : t('samples.assignChemist', 'Kimyogarga biriktirish')}
            </button>
          )}

          {canStop && (
            <button
              type="button"
              onClick={() => setStopModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-sm"
            >
              {t('samples.stopAnalysis', 'Tahlilni to‘xtatish')}
            </button>
          )}

          {canResume && (
            <button
              type="button"
              onClick={() => setResumeModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              {t('samples.resumeAnalysis', 'Tahlilni davom ettirish')}
            </button>
          )}
        </div>
      </div>

      {/* Asosiy ma'lumotlar to'ri */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chap qism: 2 ustun kenglikda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Namuna pasporti va parametrlari */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-100">
              {t('samples.generalInfo', 'Asosiy ko‘rsatkichlar')}
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.substanceName', 'Modda nomi')}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {sample.substanceName}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.type', 'Namuna turi')}
                </dt>
                <dd className="mt-1">
                  <SampleTypeBadge type={sample.type} />
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.serialNumber', 'Seriya raqami')}
                </dt>
                <dd className="mt-1 font-mono text-slate-900">
                  {sample.serialNumber || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.lotNumber', 'Partiya (Lot) raqami')}
                </dt>
                <dd className="mt-1 font-mono text-slate-900">
                  {sample.lotNumber || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.quantity', 'Miqdori')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {sample.quantity || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.manufacturer', 'Ishlab chiqaruvchi')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {sample.manufacturer || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.manufacturedAt', 'Ishlab chiqarilgan sana')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {sample.manufacturedAt || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.createdAt', 'Kiritilgan vaqt')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {new Date(sample.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>

            <h2 className="text-base font-semibold text-slate-900 pt-4 pb-2 border-b border-slate-100">
              {t('samples.analysisSchedule', 'Tahlil muddati va ijrochilar')}
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.analysisStart', 'Tahlil boshlanishi')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {sample.analysisStart || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.analysisEnd', 'Tahlil tugashi')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {sample.analysisEnd || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.assignedChemistLabel', 'Biriktirilgan kimyogar')}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {sample.assignedToName || sample.assigned_to_name ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                      {sample.assignedToName || sample.assigned_to_name}
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      —
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('samples.assignedAt', 'Biriktirilgan sana')}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {sample.assignedAt ? new Date(sample.assignedAt).toLocaleString() : '—'}
                </dd>
              </div>
            </dl>

            {sample.stopReason && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wide">
                  {t('samples.stopReason', 'To‘xtatish sababi')}
                </h3>
                <p className="mt-1 text-sm text-rose-900">{sample.stopReason}</p>
                {sample.stoppedAt && (
                  <p className="mt-1 text-xs text-rose-600">
                    {t('samples.stoppedAt', 'To‘xtatilgan vaqt')}:{' '}
                    {new Date(sample.stoppedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {sample.notes && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">
                  {t('samples.notes', 'Qo‘shimcha izohlar')}
                </h3>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                  {sample.notes}
                </p>
              </div>
            )}
          </div>

          {/* Protokol va Pasport bloklari */}
          <ProtocolSection sample={sample} />
          <PassportSection sample={sample} />
        </div>

        {/* O'ng qism: Tracking va Audit tarixi */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 pb-4 mb-4 border-b border-slate-100">
              {t('samples.timelineTitle', 'Harakatlar tarixi')}
            </h2>
            <SampleTrackingTimeline tracking={sample.tracking} />
          </div>
        </div>
      </div>

      {/* Modallar */}
      {canAssign && (
        <SampleAssignModal
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          sample={sample}
        />
      )}

      <SampleStopModal
        open={stopModalOpen}
        onClose={() => setStopModalOpen(false)}
        sample={sample}
      />

      <SampleResumeModal
        open={resumeModalOpen}
        onClose={() => setResumeModalOpen(false)}
        sample={sample}
      />
    </div>
  );
};
