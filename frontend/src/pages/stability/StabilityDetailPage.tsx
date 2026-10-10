import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import {
  useCompleteCheckpointMutation,
  useDeleteCheckpointMutation,
  useStabilityStudyQuery,
} from '@/hooks/useStability';
import { useAuthStore } from '@/store/authStore';
import type { StabilityCheckpointDto } from '@/types';
import { CreateCheckpointModal } from './CreateCheckpointModal';
import { RecordResultsModal } from './RecordResultsModal';
import {
  CheckpointStatusBadge,
  ResultStatusBadge,
  StudyStatusBadge,
} from './StabilityStatusBadge';

export const StabilityDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const { data: study, isLoading, isError } = useStabilityStudyQuery(id ?? '');
  const deleteCheckpointMutation = useDeleteCheckpointMutation(id ?? '');
  const completeCheckpointMutation = useCompleteCheckpointMutation(id ?? '');

  const [createCpOpen, setCreateCpOpen] = useState(false);
  const [activeCpForResults, setActiveCpForResults] = useState<StabilityCheckpointDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !study) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('stability.notFound', 'Stabilizatsiya tekshiruvi topilmadi')}
        </h2>
        <div className="mt-6">
          <Link
            to="/stability"
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            ← {t('stability.backToList', 'Ro‘yxatga qaytish')}
          </Link>
        </div>
      </div>
    );
  }

  const role = user?.role;
  const canStart = role === 'lab_head' || role === 'director' || role === 'admin';
  const canRecordBase =
    role === 'chemist' || role === 'lab_head' || role === 'director' || role === 'admin';

  const canRecordCheckpoint = (cp: StabilityCheckpointDto) => {
    if (!canRecordBase) return false;
    if (role === 'chemist') {
      return Boolean(user?.id && cp.assignedTo === user.id);
    }
    return true;
  };

  const handleDeleteCheckpoint = async (cpId: string) => {
    if (!window.confirm(t('stability.deleteConfirm', 'Ushbu checkpointni o‘chirishni tasdiqlaysizmi?'))) {
      return;
    }
    setActionError(null);
    try {
      await deleteCheckpointMutation.mutateAsync(cpId);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? t('common.error', 'Xatolik yuz berdi');
      setActionError(msg);
    }
  };

  const handleCompleteCheckpoint = async (cpId: string) => {
    if (
      !window.confirm(
        t(
          'stability.completeConfirm',
          'Barcha parametrlar to‘ldirilgan bo‘lsa, ushbu checkpoint yakunlanadi. Davom etasizmi?',
        ),
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await completeCheckpointMutation.mutateAsync({ checkpointId: cpId });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? t('common.error', 'Xatolik yuz berdi');
      setActionError(msg);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Yuqori navigatsiya va sarlavha */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/stability"
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              ← {t('stability.title')}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-900">{study.substanceName}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {study.substanceName} {study.serialNumber ? `(${study.serialNumber})` : ''}
            </h1>
            <StudyStatusBadge status={study.status} />
          </div>
        </div>

        {canStart && study.status === 'active' && (
          <button
            onClick={() => setCreateCpOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition"
          >
            + {t('stability.addCheckpoint')}
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {/* Tadqiqot haqida kartochka */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">
          {t('stability.detailTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-500 block">{t('stability.sample')}:</span>
            <Link
              to={`/samples/${study.sampleId}`}
              className="font-medium text-indigo-600 hover:underline"
            >
              {study.substanceName}
            </Link>
          </div>
          <div>
            <span className="text-slate-500 block">{t('stability.serialNumber')}:</span>
            <span className="font-medium text-slate-800">{study.serialNumber || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('stability.startedAt')}:</span>
            <span className="font-medium text-slate-800">{study.startedAt}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('stability.storageConditions')}:</span>
            <span className="font-medium text-slate-800">{study.storageConditions || '—'}</span>
          </div>
        </div>
      </div>

      {/* Checkpointlar ro'yxati */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('stability.checkpoints')} ({study.checkpoints.length})
          </h2>
        </div>

        {study.checkpoints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 bg-white">
            {t('stability.noCheckpoints')}
          </div>
        ) : (
          study.checkpoints.map((cp) => {
            const canRecord = canRecordCheckpoint(cp);
            const isCompleted = cp.status === 'completed';

            return (
              <div
                key={cp.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Checkpoint boshqaruv paneli */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50/80 px-5 py-3 border-b border-slate-200 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-900">{cp.intervalTag}</span>
                    <CheckpointStatusBadge status={cp.status} isDueSoon={cp.isDueSoon} />
                    <span className="text-xs text-slate-500">
                      {t('stability.dueDate')}: <strong className="text-slate-700">{cp.dueDate}</strong>
                    </span>
                    {cp.assignedToName && (
                      <span className="text-xs text-slate-500">
                        {t('stability.assignedTo')}:{' '}
                        <span className="text-slate-700 font-medium">{cp.assignedToName}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canRecord && !isCompleted && (
                      <>
                        <button
                          onClick={() => setActiveCpForResults(cp)}
                          className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          {t('stability.recordResults')}
                        </button>
                        <button
                          onClick={() => handleCompleteCheckpoint(cp.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          {t('stability.complete')}
                        </button>
                      </>
                    )}

                    {canStart && cp.status === 'pending' && (
                      <button
                        onClick={() => handleDeleteCheckpoint(cp.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:border-rose-200 transition"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Checkpoint natijalar jadvali */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-2.5">{t('stability.parameter')}</th>
                        <th className="px-4 py-2.5">{t('stability.initialValue')}</th>
                        <th className="px-4 py-2.5">{t('stability.currentValue')}</th>
                        <th className="px-4 py-2.5">{t('stability.specification')}</th>
                        <th className="px-4 py-2.5">{t('stability.resultStatus')}</th>
                        <th className="px-4 py-2.5">{t('common.recordedBy', 'Kirituvchi')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(cp.results ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-4 text-center text-slate-400 text-xs">
                            {t('stability.noParams')}
                          </td>
                        </tr>
                      ) : (
                        (cp.results ?? []).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-2.5 font-medium text-slate-900">{r.parameter}</td>
                            <td className="px-4 py-2.5 text-slate-500">{r.initialValue ?? '—'}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {r.currentValue ?? <span className="text-slate-400 font-normal">{t('stability.notRecorded')}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{r.specification ?? '—'}</td>
                            <td className="px-4 py-2.5">
                              {r.currentValue ? (
                                <ResultStatusBadge status={r.resultStatus} />
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">
                              {r.recordedByName ?? '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modallar */}
      {createCpOpen && (
        <CreateCheckpointModal
          studyId={study.id}
          isOpen={createCpOpen}
          onClose={() => setCreateCpOpen(false)}
        />
      )}

      {activeCpForResults && (
        <RecordResultsModal
          studyId={study.id}
          checkpoint={activeCpForResults}
          isOpen={Boolean(activeCpForResults)}
          onClose={() => setActiveCpForResults(null)}
        />
      )}
    </div>
  );
};
