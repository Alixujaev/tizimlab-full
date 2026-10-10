import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { useStabilityStudiesQuery } from '@/hooks/useStability';
import { useAuthStore } from '@/store/authStore';
import type { StabilityStudyStatus } from '@/types';
import { CreateStudyModal } from './CreateStudyModal';
import { StudyStatusBadge } from './StabilityStatusBadge';

export const StabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StabilityStudyStatus | ''>('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const role = user?.role;
  const canStart = role === 'lab_head' || role === 'director' || role === 'admin';

  const { data, isLoading } = useStabilityStudiesQuery({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    page,
    limit: 20,
  });

  const studies = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Sarlavha va harakat tugmasi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('stability.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('stability.subtitle')}
          </p>
        </div>

        {canStart && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition"
          >
            + {t('stability.newStudy')}
          </button>
        )}
      </div>

      {/* Filtrlash paneli */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('stability.search')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              statusFilter === ''
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('stability.all')}
          </button>
          <button
            onClick={() => {
              setStatusFilter('active');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              statusFilter === 'active'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('stability.active')}
          </button>
          <button
            onClick={() => {
              setStatusFilter('completed');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              statusFilter === 'completed'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('stability.completed')}
          </button>
        </div>
      </div>

      {/* Tadqiqotlar ro'yxati */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : studies.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {t('stability.noStudies')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">{t('stability.substanceName')}</th>
                  <th className="px-4 py-3.5">{t('stability.serialNumber')}</th>
                  <th className="px-4 py-3.5">{t('stability.startedAt')}</th>
                  <th className="px-4 py-3.5">{t('stability.storageConditions')}</th>
                  <th className="px-4 py-3.5">{t('stability.checkpoints')}</th>
                  <th className="px-4 py-3.5">{t('stability.status')}</th>
                  <th className="px-6 py-3.5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {studies.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <Link
                        to={`/stability/${s.id}`}
                        className="hover:text-indigo-600 hover:underline"
                      >
                        {s.substanceName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{s.serialNumber || '—'}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs">{s.startedAt}</td>
                    <td className="px-4 py-4 text-slate-600 text-xs">{s.storageConditions || '—'}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        <strong className="text-emerald-700">{s.completedCheckpoints}</strong> /{' '}
                        <span>{s.totalCheckpoints}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StudyStatusBadge status={s.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/stability/${s.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                      >
                        {t('common.view')} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sahifalash */}
        {meta && meta.total > meta.limit && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {t('stability.totalStudies', { count: meta.total })}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
              >
                {t('stability.prev')}
              </button>
              <span className="text-xs text-slate-600">{page}</span>
              <button
                disabled={page * meta.limit >= meta.total}
                onClick={() => setPage(page + 1)}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
              >
                {t('stability.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {createModalOpen && (
        <CreateStudyModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(id) => navigate(`/stability/${id}`)}
        />
      )}
    </div>
  );
};
