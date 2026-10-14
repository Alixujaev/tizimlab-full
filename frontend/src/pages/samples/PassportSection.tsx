import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPassportDownloadLink } from '@/api/samples';
import { useReviewPassportMutation, useUploadPassportMutation } from '@/hooks/useSamples';
import { openDownload } from '@/lib/files';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { Role, SampleDetailDto } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  FileDropzone,
  type FileRejectReason,
  Icon,
  notify,
  StatusPill,
  type Tone,
} from '@/ui';
import { PassportDeleteModal } from './PassportDeleteModal';
import { PassportRejectModal } from './PassportRejectModal';

type Flow = 'approval' | 'attachment' | 'none';

// Backend qoidalarining aksi (spec §3, D-40, D-41, D-111, D-119) — faqat UI ko'rinishi; majburlash backend'da.
function flowOf(type: SampleDetailDto['type']): Flow {
  if (type === 'reagent' || type === 'standard_substance') return 'approval';
  if (type === 'raw_material' || type === 'finished_product') return 'attachment';
  return 'none';
}

const isReviewer = (role?: Role) => role === 'lab_head' || role === 'admin';

const STATUS_TONE: Record<string, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

// FileDropzone sabablari → pasport tarjima kalitlari
const REJECT_KEY: Record<FileRejectReason, string> = {
  badType: 'unsupported',
  tooLarge: 'tooLarge',
  empty: 'empty',
};

export function PassportSection({ sample }: { sample: SampleDetailDto }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const uploadMutation = useUploadPassportMutation();
  const reviewMutation = useReviewPassportMutation();
  const [fileError, setFileError] = useState<string | null>(null);
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

  const upload = async (file: File | null) => {
    if (!file) return;
    setFileError(null);
    try {
      await uploadMutation.mutateAsync({ id: sample.id, file });
      notify.success(t('samples.passport.uploaded'));
    } catch (err) {
      setFileError(errorMessage(err));
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      openDownload((await fetchPassportDownloadLink(sample.id)).url);
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await reviewMutation.mutateAsync({ id: sample.id, input: { decision: 'approve' } });
      notify.success(t('samples.passport.approved'));
    } catch (err) {
      notify.error(errorMessage(err));
    }
  };

  return (
    <Card
      title={t('samples.passportTitle')}
      description={
        flow === 'attachment'
          ? t('samples.passport.attachmentNotice')
          : t('samples.passport.approvalFlowNotice')
      }
      actions={
        status ? (
          <span data-testid="passport-status">
            <StatusPill tone={STATUS_TONE[status] ?? 'neutral'}>
              {t(`samples.passportStatus.${status}`)}
            </StatusPill>
          </span>
        ) : (
          !hasFile && <Badge>{t('samples.noPassport')}</Badge>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {hasFile && (
          <div className="flex flex-col gap-3 rounded-lg bg-surface-muted px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-fg">
                <Icon name="file-text" size="sm" />
              </span>
              <span className="break-all text-sm font-medium text-fg">
                {sample.passportFileName}
              </span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                leftIcon="download"
                loading={downloading}
                onClick={() => void handleDownload()}
              >
                {t('samples.passport.download')}
              </Button>
              {canDelete && (
                <Button
                  variant="danger-ghost"
                  size="sm"
                  leftIcon="trash"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t('samples.passport.delete')}
                </Button>
              )}
            </span>
          </div>
        )}

        {rejectReason && (
          <Alert tone="danger" title={t('samples.passport.rejectedReasonLabel')}>
            {rejectReason}
          </Alert>
        )}

        {canReview && (
          <div className="flex flex-wrap gap-2">
            <Button
              leftIcon="check"
              loading={reviewMutation.isPending}
              onClick={() => void handleApprove()}
            >
              {t('samples.passport.approve')}
            </Button>
            <Button variant="danger-ghost" onClick={() => setRejectOpen(true)}>
              {t('samples.passport.reject')}
            </Button>
          </div>
        )}
        {showOwnNotice && (
          <p className="text-sm text-fg-muted">{t('samples.passport.ownPassportNotice')}</p>
        )}

        {canUpload && (
          <div className="flex flex-col gap-2">
            {flow === 'approval' && (
              <p className="text-sm text-fg-muted">
                {isReviewer(role)
                  ? t('samples.passport.autoApproveNotice')
                  : t('samples.passport.pendingNotice')}
              </p>
            )}
            <FileDropzone
              value={null}
              onChange={(file) => void upload(file)}
              loading={uploadMutation.isPending}
              aria-label={t('samples.passport.fileInputLabel')}
              error={fileError ?? undefined}
              onReject={(reason) =>
                setFileError(t(`samples.passport.fileErrors.${REJECT_KEY[reason]}`))
              }
            />
          </div>
        )}

        {/* Fayl yo'q holatda yuklash xatosi (masalan, yuklagandan keyin ham) */}
        {!canUpload && fileError && <Alert tone="danger">{fileError}</Alert>}
      </div>

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
    </Card>
  );
}
