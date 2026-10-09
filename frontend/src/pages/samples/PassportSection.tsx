import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchPassportDownloadLink } from '@/api/samples';
import { Spinner } from '@/components/ui/Spinner';
import { useReviewPassportMutation, useUploadPassportMutation } from '@/hooks/useSamples';
import { checkFile, FILE_ACCEPT, openDownload } from '@/lib/files';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { Role, SampleDetailDto } from '@/types';
import { PassportDeleteModal } from './PassportDeleteModal';
import { PassportRejectModal } from './PassportRejectModal';

interface PassportSectionProps {
  sample: SampleDetailDto;
}

type Flow = 'approval' | 'attachment' | 'none';

// Backend qoidalarining aksi (spec §3, D-40, D-41, D-111, D-119) — faqat UI ko'rinishi; majburlash backend'da.
function flowOf(type: SampleDetailDto['type']): Flow {
  if (type === 'reagent' || type === 'standard_substance') return 'approval';
  if (type === 'raw_material' || type === 'finished_product') return 'attachment';
  return 'none';
}

const isReviewer = (role?: Role) => role === 'lab_head' || role === 'admin';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const PassportSection: React.FC<PassportSectionProps> = ({ sample }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const uploadMutation = useUploadPassportMutation();
  const reviewMutation = useReviewPassportMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const flow = flowOf(sample.type);
  if (flow === 'none') return null;

  const role = user?.role;
  const isMine = Boolean(user && sample.passportUploadedBy === user.id);
  const hasFile = Boolean(sample.passportFileName);
  const status = sample.passportStatus ?? null;

  const canUpload =
    flow === 'approval'
      ? ['kontrolyor', 'chemist', 'lab_head', 'admin'].includes(role ?? '') &&
        sample.status === 'pending_assignment' &&
        (!hasFile || (status === 'rejected' && (isMine || isReviewer(role))))
      : !hasFile &&
        (role === 'kontrolyor' ||
          isReviewer(role) ||
          (role === 'chemist' && sample.assignedTo === user?.id));

  const canReview = flow === 'approval' && isReviewer(role) && status === 'pending' && !isMine;
  const showOwnNotice = flow === 'approval' && isReviewer(role) && status === 'pending' && isMine;
  const canDelete =
    hasFile && (isReviewer(role) || (isMine && role !== 'director' && status !== 'approved'));

  const rejectReason =
    status === 'rejected'
      ? [...sample.tracking]
          .reverse()
          .find((e) => e.eventType === 'passport_reviewed' && e.metadata?.decision === 'reject')
          ?.reason
      : null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkFile(file);
    if (problem) {
      setFileError(t(`samples.passport.fileErrors.${problem}`));
      return;
    }
    setFileError(null);
    try {
      await uploadMutation.mutateAsync({ id: sample.id, file });
      toast.success(t('samples.passport.uploaded'));
    } catch (err) {
      setFileError(errorMessage(err));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      openDownload((await fetchPassportDownloadLink(sample.id)).url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await reviewMutation.mutateAsync({ id: sample.id, input: { decision: 'approve' } });
      toast.success(t('samples.passport.approved'));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const notice =
    flow === 'attachment'
      ? t('samples.passport.attachmentNotice')
      : t('samples.passport.approvalFlowNotice');

  return (
    <section
      aria-labelledby="passport-title"
      className="bg-white rounded-lg border border-slate-200 shadow-sm p-5"
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 id="passport-title" className="text-base font-semibold text-slate-900">
          {t('samples.passportTitle')}
        </h3>
        {status ? (
          <span
            data-testid="passport-status"
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[status]}`}
          >
            {t(`samples.passportStatus.${status}`)}
          </span>
        ) : (
          !hasFile && <span className="text-xs text-slate-400">{t('samples.noPassport')}</span>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-600">{notice}</p>

      {hasFile && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-sm font-medium text-slate-700 break-all">
            {sample.passportFileName}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
            >
              {t('samples.passport.download')}
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="px-3 py-1 text-xs font-medium rounded border border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
              >
                {t('samples.passport.delete')}
              </button>
            )}
          </div>
        </div>
      )}

      {rejectReason && (
        <p className="mt-3 text-xs text-rose-700">
          {t('samples.passport.rejectedReasonLabel')}: {rejectReason}
        </p>
      )}

      {canReview && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={reviewMutation.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {t('samples.passport.approve')}
          </button>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            className="px-3 py-1.5 text-sm font-medium rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
          >
            {t('samples.passport.reject')}
          </button>
        </div>
      )}
      {showOwnNotice && (
        <p className="mt-3 text-xs text-slate-500">{t('samples.passport.ownPassportNotice')}</p>
      )}

      {canUpload && (
        <div className="mt-4">
          {flow === 'approval' && (
            <p className="mb-2 text-xs text-slate-500">
              {isReviewer(role)
                ? t('samples.passport.autoApproveNotice')
                : t('samples.passport.pendingNotice')}
            </p>
          )}
          <div
            data-testid="passport-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFile(e.dataTransfer.files[0]);
            }}
            className={`text-center py-6 px-4 border border-dashed rounded-lg ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'
            }`}
          >
            {uploadMutation.isPending ? (
              <Spinner />
            ) : (
              <p className="text-sm text-slate-600">
                {t('samples.passport.dropzone')}{' '}
                <label className="font-medium text-blue-600 underline cursor-pointer">
                  {t('samples.passport.chooseFile')}
                  <input
                    ref={inputRef}
                    type="file"
                    accept={FILE_ACCEPT}
                    aria-label={t('samples.passport.fileInputLabel')}
                    className="sr-only"
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                  />
                </label>
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">{t('samples.passport.fileHint')}</p>
          </div>
        </div>
      )}

      {fileError && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {fileError}
        </p>
      )}

      <PassportRejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        sampleId={sample.id}
      />
      <PassportDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        sampleId={sample.id}
        fileName={sample.passportFileName ?? ''}
        approved={status === 'approved' || sample.status === 'approved'}
      />
    </section>
  );
};
