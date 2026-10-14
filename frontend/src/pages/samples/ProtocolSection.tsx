import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  exportProtocolDocx,
  getProtocolExtraFileDownload,
  getProtocolFileDownload,
  getProtocolPassportDownload,
} from '@/api/protocols';
import {
  useApproveProtocolMutation,
  useCreateInProcessProtocolMutation,
  useDeleteProtocolExtraFileMutation,
  useDeleteProtocolFileMutation,
  useDeleteProtocolPassportMutation,
  useFinalizeProtocolMutation,
  useProtocolFilesQuery,
  useProtocolQuery,
  useProtocolsBySampleQuery,
  useRejectProtocolMutation,
  useSubmitProtocolMutation,
  useUploadProtocolExtraFileMutation,
  useUploadProtocolFileMutation,
  useUploadProtocolPassportMutation,
} from '@/hooks/useProtocols';
import { ALLOWED_EXTENSIONS } from '@/lib/files';
import { useAuthStore } from '@/store/authStore';
import type { ProtocolFileDto, ProtocolStatus, SampleDetailDto } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FileButton,
  formatBytes,
  Icon,
  Skeleton,
  StatusPill,
  Tabs,
  type Tone,
} from '@/ui';
import { ProtocolRejectModal } from './ProtocolRejectModal';

const PROTOCOL_STATUS_TONE: Record<ProtocolStatus, Tone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  finalized: 'accent',
};

export function ProtocolStatusPill({ status }: { status: ProtocolStatus }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={PROTOCOL_STATUS_TONE[status] ?? 'neutral'}>
      {t(`protocols.status.${status}`, status)}
    </StatusPill>
  );
}

/** Fayl bloki: sarlavha, holat belgisi va mazmun. */
function FileBlock({
  title,
  description,
  status,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {description && <p className="text-xs text-fg-muted">{description}</p>}
        </div>
        {status}
      </div>
      {children}
    </div>
  );
}

/** Yuklangan fayl qatori: nom, meta va amallar. */
function FileRow({ name, meta, actions }: { name: string; meta?: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-muted px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-fg">
          <Icon name="file-text" size="sm" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{name}</p>
          {meta && <p className="text-xs text-fg-muted">{meta}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  );
}

function openInNewTab(url: string) {
  window.open(url, '_blank');
}

export function ProtocolSection({ sample }: { sample: SampleDetailDto }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const { data: protocols, isLoading } = useProtocolsBySampleQuery(sample.id);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPassport, setDownloadingPassport] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);

  const activeProtocolSummary =
    protocols?.find((p) => p.id === selectedProtocolId) ?? protocols?.[0];
  const activeProtocolId = activeProtocolSummary?.id ?? null;

  const { data: activeProtocolDetail, isLoading: isDetailLoading } =
    useProtocolQuery(activeProtocolId);
  const { data: protocolFilesData } = useProtocolFilesQuery(activeProtocolId);

  const createInProcessMutation = useCreateInProcessProtocolMutation(sample.id);
  const uploadFileMutation = useUploadProtocolFileMutation(sample.id);
  const deleteFileMutation = useDeleteProtocolFileMutation(sample.id);
  const uploadPassportMutation = useUploadProtocolPassportMutation(sample.id);
  const deletePassportMutation = useDeleteProtocolPassportMutation(sample.id);
  const uploadExtraFileMutation = useUploadProtocolExtraFileMutation(sample.id);
  const deleteExtraFileMutation = useDeleteProtocolExtraFileMutation(sample.id);
  const submitMutation = useSubmitProtocolMutation(sample.id);
  const approveMutation = useApproveProtocolMutation(sample.id);
  const rejectMutation = useRejectProtocolMutation(sample.id);
  const finalizeMutation = useFinalizeProtocolMutation(sample.id);

  const isKontrolyor = user?.role === 'kontrolyor';
  const isAssignedChemist =
    user?.role === 'chemist' && Boolean(user?.id && sample.assignedTo === user.id);
  const isLabHead = user?.role === 'lab_head';
  const isDirector = user?.role === 'director';
  const isAdmin = user?.role === 'admin';
  const editableStatus =
    activeProtocolSummary?.status === 'draft' || activeProtocolSummary?.status === 'rejected';

  // Fayl yuklash huquqi (D-45, D-47)
  const canUploadMain =
    (isAssignedChemist || isLabHead || isAdmin) && editableStatus && sample.status !== 'stopped';
  // Yuborish huquqi — faqat biriktirilgan kimyogar (D-45)
  const canSubmit = isAssignedChemist && editableStatus && sample.status !== 'stopped';
  // Tasdiqlash va rad etish huquqi — faqat lab_head (D-45, D-122)
  const canReview = isLabHead && activeProtocolSummary?.status === 'submitted';
  // Yakunlash huquqi — faqat direktor (D-07, D-50)
  const canFinalize = isDirector && activeProtocolSummary?.status === 'approved';
  // Oraliq protokol yaratish imkoniyati (D-15, R-PROTO-53)
  const hasInProcess = Boolean(protocols?.some((p) => p.protocolRole === 'in_process'));
  const canCreateInProcess =
    sample.type === 'finished_product' &&
    !hasInProcess &&
    sample.status !== 'approved' &&
    (isLabHead || isAssignedChemist);
  // Pasport yuklash huquqi (D-123): kontrolyor, lab_head, admin, biriktirilgan chemist. Direktor yo'q.
  const canUploadPassport =
    !isDirector && (isKontrolyor || isLabHead || isAdmin || isAssignedChemist);

  const activeProto = activeProtocolDetail ?? activeProtocolSummary;
  // Pasport o'chirish huquqi (D-123)
  const canDeletePassport =
    isLabHead || isAdmin || Boolean(user?.id && activeProto?.passportUploadedBy === user.id);

  // Qo'shimcha fayllar (D-49, D-76, D-124)
  const extraFiles: ProtocolFileDto[] = protocolFilesData ?? activeProtocolDetail?.files ?? [];
  const canUploadExtraFiles =
    sample.type === 'finished_product' &&
    (isAssignedChemist || isLabHead || isAdmin) &&
    editableStatus &&
    sample.status !== 'stopped' &&
    extraFiles.length < 10;

  const roleLabel = (role: string) => t(`protocols.roles.${role}`, role);

  const withFlag = async (set: (v: boolean) => void, run: () => Promise<void>) => {
    try {
      set(true);
      await run();
    } finally {
      set(false);
    }
  };

  const handleMainDownload = () =>
    activeProtocolId &&
    withFlag(setDownloading, async () =>
      openInNewTab((await getProtocolFileDownload(activeProtocolId)).url),
    );

  const handlePassportDownload = () =>
    activeProtocolId &&
    withFlag(setDownloadingPassport, async () =>
      openInNewTab((await getProtocolPassportDownload(activeProtocolId)).url),
    );

  const handleExtraFileDownload = async (fileId: string) => {
    if (!activeProtocolId) return;
    try {
      setDownloadingFileId(fileId);
      openInNewTab((await getProtocolExtraFileDownload(activeProtocolId, fileId)).url);
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleExportDocx = () =>
    activeProtocolId &&
    withFlag(setExportingDocx, async () => {
      const lang = (['uz', 'ru', 'en'].includes(i18n.language) ? i18n.language : 'uz') as
        'uz' | 'ru' | 'en';
      const blob = await exportProtocolDocx(activeProtocolId, lang);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protocol-${activeProtocolId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    });

  const handleRejectConfirm = async (reason: string) => {
    if (!activeProtocolId) return;
    await rejectMutation.mutateAsync({ id: activeProtocolId, input: { reason } });
    setIsRejectModalOpen(false);
  };

  const title = t('protocols.title', 'Tahlil protokoli');

  if (isLoading) {
    return (
      <Card title={title}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton variant="rect" className="h-12 w-full" />
          <Skeleton variant="rect" className="h-24 w-full" />
        </div>
      </Card>
    );
  }

  // Protokol hali mavjud bo'lmasa (masalan, biriktirilmagan namuna)
  if (!protocols || protocols.length === 0) {
    return (
      <Card title={title}>
        <EmptyState
          size="sm"
          icon="file-text"
          title={
            sample.status === 'pending_assignment'
              ? t(
                  'protocols.pendingAssignmentNotice',
                  'Namuna kimyogarga biriktirilgach tahlil protokoli avtomatik yaratiladi.',
                )
              : t('protocols.noProtocolsNotice', 'Ushbu namunada protokollar topilmadi.')
          }
        />
      </Card>
    );
  }

  const protocolTabs =
    protocols.length > 1 ? (
      <Tabs
        label={title}
        value={activeProtocolId ?? ''}
        onChange={setSelectedProtocolId}
        items={protocols.map((p) => ({
          id: p.id,
          label: roleLabel(p.protocolRole),
          badge: isKontrolyor ? undefined : t(`protocols.status.${p.status}`, p.status),
        }))}
      />
    ) : null;

  const detailLoading = isDetailLoading && !activeProtocolDetail;
  const loadingBlock = (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton variant="rect" className="h-24 w-full" />
    </div>
  );

  // Pasport bloki (barcha rollar uchun)
  const passportBlock = activeProto ? (
    <FileBlock
      title={t('protocols.passportTitle', 'Protokol pasporti')}
      description={t('protocols.passportDesc', 'Qo‘shimcha tasdiqlanmagan holatsiz hujjat')}
      status={
        activeProto.passportFilePath ? (
          <Badge tone="success" icon="check">
            {t('protocols.passportUploaded', 'Pasport biriktirilgan')}
          </Badge>
        ) : (
          <Badge>{t('protocols.passportMissing', 'Pasport yuklanmagan')}</Badge>
        )
      }
    >
      {activeProto.passportFilePath && activeProto.passportFileName ? (
        <FileRow
          name={activeProto.passportFileName}
          meta={
            activeProto.passportFileSize ? formatBytes(activeProto.passportFileSize) : undefined
          }
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon="download"
                loading={downloadingPassport}
                onClick={() => void handlePassportDownload()}
              >
                {t('common.download', 'Yuklab olish')}
              </Button>
              {canUploadPassport && (
                <FileButton
                  accept={ALLOWED_EXTENSIONS}
                  leftIcon="refresh"
                  loading={uploadPassportMutation.isPending}
                  onSelect={(file) =>
                    activeProtocolId &&
                    uploadPassportMutation.mutate({ id: activeProtocolId, file })
                  }
                >
                  {t('common.replace', 'Almashtirish')}
                </FileButton>
              )}
              {canDeletePassport && (
                <Button
                  variant="danger-ghost"
                  size="sm"
                  leftIcon="trash"
                  loading={deletePassportMutation.isPending}
                  onClick={() => deletePassportMutation.mutate(activeProto.id)}
                >
                  {t('common.delete', 'O‘chirish')}
                </Button>
              )}
            </>
          }
        />
      ) : canUploadPassport ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-muted px-4 py-6 text-center">
          <FileButton
            accept={ALLOWED_EXTENSIONS}
            size="md"
            loading={uploadPassportMutation.isPending}
            onSelect={(file) =>
              activeProtocolId && uploadPassportMutation.mutate({ id: activeProtocolId, file })
            }
          >
            {t('protocols.uploadPassportBtn', 'Protokol pasportini yuklash')}
          </FileButton>
          <p className="text-xs text-fg-muted">
            {t('protocols.fileHints', 'PDF, Word (.docx, .doc), PNG, JPEG (maksimal 20 MB)')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          {t('protocols.passportMissing', 'Pasport yuklanmagan')}
        </p>
      )}
    </FileBlock>
  ) : null;

  // KONTROLYOR: FAQAT pasport blokini ko'radi (Qoida 5)
  if (isKontrolyor) {
    return (
      <Card title={title}>
        <div className="flex flex-col gap-4">
          {protocolTabs}
          {detailLoading ? loadingBlock : passportBlock}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {title}
          <Badge size="sm">{protocols.length}</Badge>
        </span>
      }
      actions={
        <>
          {activeProtocolId && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon="download"
              loading={exportingDocx}
              onClick={() => void handleExportDocx()}
            >
              {t('protocols.exportDocx', 'DOCX yuklab olish')}
            </Button>
          )}
          {canCreateInProcess && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon="plus"
              loading={createInProcessMutation.isPending}
              onClick={() => createInProcessMutation.mutate()}
            >
              {t('protocols.createInProcess', 'Oraliq protokol qo‘shish')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {protocolTabs}

        {detailLoading ? (
          loadingBlock
        ) : activeProto ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fg">
                  {roleLabel(activeProto.protocolRole)}
                </span>
                <ProtocolStatusPill status={activeProto.status} />
              </div>
              {activeProto.createdAt && (
                <span className="text-xs text-fg-muted">
                  {t('common.created', 'Yaratilgan')}:{' '}
                  {new Date(activeProto.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {activeProto.status === 'rejected' && activeProto.rejectionReason && (
              <Alert
                tone="danger"
                title={t('protocols.rejectedNotice', 'Laboratoriya mudiri tomonidan rad etilgan')}
              >
                <p className="font-medium">{activeProto.rejectionReason}</p>
                <p className="mt-1 text-xs">
                  {t(
                    'protocols.rejectionFixNotice',
                    'Faylni yangilang va protokolni qayta yuboring.',
                  )}
                </p>
              </Alert>
            )}

            {/* 1. Asosiy fayl */}
            <FileBlock
              title={t('protocols.mainFile', 'Asosiy tahlil hisoboti (majburiy)')}
              status={
                activeProto.filePath ? (
                  <Badge tone="success" icon="check">
                    {t('protocols.fileUploaded', 'Fayl biriktirilgan')}
                  </Badge>
                ) : (
                  <Badge tone="warning">{t('protocols.fileMissing', 'Fayl yuklanmagan')}</Badge>
                )
              }
            >
              {activeProto.filePath && activeProto.fileName ? (
                <FileRow
                  name={activeProto.fileName}
                  meta={activeProto.fileMime ?? undefined}
                  actions={
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon="download"
                        loading={downloading}
                        onClick={() => void handleMainDownload()}
                      >
                        {t('common.download', 'Yuklab olish')}
                      </Button>
                      {canUploadMain && (
                        <>
                          <FileButton
                            accept={ALLOWED_EXTENSIONS}
                            leftIcon="refresh"
                            loading={uploadFileMutation.isPending}
                            onSelect={(file) =>
                              activeProtocolId &&
                              uploadFileMutation.mutate({ id: activeProtocolId, file })
                            }
                          >
                            {t('common.replace', 'Almashtirish')}
                          </FileButton>
                          <Button
                            variant="danger-ghost"
                            size="sm"
                            leftIcon="trash"
                            loading={deleteFileMutation.isPending}
                            onClick={() => deleteFileMutation.mutate(activeProto.id)}
                          >
                            {t('common.delete', 'O‘chirish')}
                          </Button>
                        </>
                      )}
                    </>
                  }
                />
              ) : canUploadMain ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-muted px-4 py-6 text-center">
                  <FileButton
                    accept={ALLOWED_EXTENSIONS}
                    size="md"
                    variant="primary"
                    loading={uploadFileMutation.isPending}
                    onSelect={(file) =>
                      activeProtocolId && uploadFileMutation.mutate({ id: activeProtocolId, file })
                    }
                  >
                    {t('protocols.uploadFileBtn', 'Tahlil hisobot faylini yuklash')}
                  </FileButton>
                  <p className="text-xs text-fg-muted">
                    {t(
                      'protocols.fileHints',
                      'PDF, Word (.docx, .doc), PNG, JPEG (maksimal 20 MB)',
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-fg-muted">
                  {t('protocols.noFileAttached', 'Fayl biriktirilmagan')}
                </p>
              )}
            </FileBlock>

            {/* 2. Protokol pasporti */}
            {passportBlock}

            {/* 3. Qo'shimcha fayllar (faqat tayyor mahsulot) */}
            {sample.type === 'finished_product' && (
              <FileBlock
                title={
                  <span className="flex items-center gap-2">
                    {t('protocols.extraFilesTitle', 'Qo‘shimcha fayllar (maksimal 10 ta)')}
                    <Badge size="sm">{extraFiles.length}/10</Badge>
                  </span>
                }
                status={
                  canUploadExtraFiles && (
                    <FileButton
                      accept={ALLOWED_EXTENSIONS}
                      leftIcon="plus"
                      loading={uploadExtraFileMutation.isPending}
                      onSelect={(file) =>
                        activeProtocolId &&
                        uploadExtraFileMutation.mutate({ id: activeProtocolId, file })
                      }
                    >
                      {t('protocols.uploadExtraFileBtn', 'Qo‘shimcha fayl yuklash')}
                    </FileButton>
                  )
                }
              >
                {extraFiles.length === 0 ? (
                  <p className="text-sm text-fg-muted">
                    {t('protocols.extraFilesEmpty', 'Qo‘shimcha fayllar mavjud emas')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {extraFiles.map((f) => {
                      const canDeleteThisFile =
                        editableStatus && (isLabHead || isAdmin || f.uploadedBy === user?.id);
                      return (
                        <FileRow
                          key={f.id}
                          name={f.fileName}
                          meta={`${formatBytes(f.fileSize)} · ${f.uploadedByName ?? f.uploadedBy} · ${new Date(f.createdAt).toLocaleString()}`}
                          actions={
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                leftIcon="download"
                                loading={downloadingFileId === f.id}
                                onClick={() => void handleExtraFileDownload(f.id)}
                              >
                                {t('common.download', 'Yuklab olish')}
                              </Button>
                              {canDeleteThisFile && (
                                <Button
                                  variant="danger-ghost"
                                  size="sm"
                                  leftIcon="trash"
                                  loading={deleteExtraFileMutation.isPending}
                                  onClick={() =>
                                    deleteExtraFileMutation.mutate({
                                      protocolId: activeProto.id,
                                      fileId: f.id,
                                    })
                                  }
                                >
                                  {t('common.delete', 'O‘chirish')}
                                </Button>
                              )}
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </FileBlock>
            )}

            {(canSubmit || canReview || canFinalize) && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                {canSubmit && (
                  <Button
                    leftIcon="send"
                    loading={submitMutation.isPending}
                    disabled={!activeProto.filePath}
                    title={
                      !activeProto.filePath
                        ? t('protocols.uploadRequiredBeforeSubmit', 'Avval fayl yuklang')
                        : undefined
                    }
                    onClick={() => submitMutation.mutate(activeProto.id)}
                  >
                    {activeProto.status === 'rejected'
                      ? t('protocols.resubmit', 'Qayta yuborish')
                      : t('protocols.submit', 'Yuborish')}
                  </Button>
                )}
                {canReview && (
                  <>
                    <Button
                      variant="danger-ghost"
                      disabled={approveMutation.isPending}
                      loading={rejectMutation.isPending}
                      onClick={() => setIsRejectModalOpen(true)}
                    >
                      {t('protocols.reject', 'Rad etish')}
                    </Button>
                    <Button
                      leftIcon="check"
                      disabled={rejectMutation.isPending}
                      loading={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(activeProto.id)}
                    >
                      {t('protocols.approve', 'Tasdiqlash')}
                    </Button>
                  </>
                )}
                {canFinalize && (
                  <Button
                    leftIcon="shield-check"
                    loading={finalizeMutation.isPending}
                    onClick={() => finalizeMutation.mutate(activeProto.id)}
                  >
                    {t('protocols.finalize', 'Yakunlash')}
                  </Button>
                )}
              </div>
            )}

            {activeProtocolDetail?.signatures && activeProtocolDetail.signatures.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <h3 className="text-sm font-semibold text-fg">
                  {t('protocols.signaturesHistory', 'Elektron imzolar tarixi')}
                </h3>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {activeProtocolDetail.signatures.map((sig) => (
                    <li
                      key={sig.id}
                      className="flex flex-col gap-1.5 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-fg">
                          {sig.userFullName ?? sig.role}
                        </span>
                        <span className="text-fg-muted">{sig.role}</span>
                        <Badge size="sm" className="font-mono">
                          {sig.action}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-3 font-mono text-fg-muted">
                        <span>{new Date(sig.signedAt).toLocaleString()}</span>
                        <span
                          className="max-w-28 truncate text-fg-subtle"
                          title={`SHA-256: ${sig.signatureHash}`}
                        >
                          {sig.signatureHash.slice(0, 10)}…
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </div>

      <ProtocolRejectModal
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={rejectMutation.isPending}
      />
    </Card>
  );
}
