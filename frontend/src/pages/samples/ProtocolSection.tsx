import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  exportProtocolDocx,
  getProtocolExtraFileDownload,
  getProtocolFileDownload,
  getProtocolPassportDownload,
} from '@/api/protocols';
import { Spinner } from '@/components/ui/Spinner';
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
import { useAuthStore } from '@/store/authStore';
import type {
  ProtocolDto,
  ProtocolFileDto,
  ProtocolRole,
  ProtocolStatus,
  SampleDetailDto,
} from '@/types';
import { ProtocolRejectModal } from './ProtocolRejectModal';

interface ProtocolSectionProps {
  sample: SampleDetailDto;
}

const statusBadgeClasses: Record<ProtocolStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  finalized: 'bg-purple-50 text-purple-700 border-purple-200',
};

const roleLabels: Record<ProtocolRole, string> = {
  standard: 'Standart tahlil',
  final: 'Yakuniy tahlil',
  in_process: 'Oraliq tahlil',
};

export const ProtocolSection: React.FC<ProtocolSectionProps> = ({ sample }) => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);

  const { data: protocols, isLoading } = useProtocolsBySampleQuery(sample.id);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPassport, setDownloadingPassport] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);

  // Faol protokolni aniqlaymiz
  const activeProtocolSummary: ProtocolDto | undefined =
    protocols?.find((p) => p.id === selectedProtocolId) ?? protocols?.[0];
  const activeProtocolId = activeProtocolSummary?.id ?? null;

  const { data: activeProtocolDetail, isLoading: isDetailLoading } =
    useProtocolQuery(activeProtocolId);
  const { data: protocolFilesData } = useProtocolFilesQuery(activeProtocolId);

  // Mutatsiyalar
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

  // Fayl yuklash huquqi (D-45, D-47)
  const canUploadMain =
    (isAssignedChemist || isLabHead || isAdmin) &&
    (activeProtocolSummary?.status === 'draft' || activeProtocolSummary?.status === 'rejected') &&
    sample.status !== 'stopped';

  // Yuborish huquqi — faqat biriktirilgan kimyogar (D-45)
  const canSubmit =
    isAssignedChemist &&
    (activeProtocolSummary?.status === 'draft' || activeProtocolSummary?.status === 'rejected') &&
    sample.status !== 'stopped';

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

  // Pasport yuklash huquqi (D-123)
  // kontrolyor, lab_head, admin, biriktirilgan chemist. Direktor yo'q. Qulf ta'sir qilmaydi.
  const canUploadPassport =
    !isDirector &&
    (isKontrolyor || isLabHead || isAdmin || isAssignedChemist);

  const activeProto = activeProtocolDetail ?? activeProtocolSummary;

  // Pasport o'chirish huquqi (D-123)
  const canDeletePassport =
    isLabHead ||
    isAdmin ||
    Boolean(user?.id && activeProto?.passportUploadedBy === user.id);

  // Qo'shimcha fayllar (D-49, D-76, D-124)
  const extraFiles: ProtocolFileDto[] =
    protocolFilesData ?? activeProtocolDetail?.files ?? [];
  const canUploadExtraFiles =
    sample.type === 'finished_product' &&
    (isAssignedChemist || isLabHead || isAdmin) &&
    (activeProtocolSummary?.status === 'draft' || activeProtocolSummary?.status === 'rejected') &&
    sample.status !== 'stopped' &&
    extraFiles.length < 10;

  const handleMainFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProtocolId) return;
    try {
      await uploadFileMutation.mutateAsync({ id: activeProtocolId, file });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePassportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProtocolId) return;
    try {
      await uploadPassportMutation.mutateAsync({ id: activeProtocolId, file });
    } finally {
      if (passportInputRef.current) passportInputRef.current.value = '';
    }
  };

  const handleExtraFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProtocolId) return;
    try {
      await uploadExtraFileMutation.mutateAsync({ id: activeProtocolId, file });
    } finally {
      if (extraFileInputRef.current) extraFileInputRef.current.value = '';
    }
  };

  const handleMainDownload = async () => {
    if (!activeProtocolId) return;
    try {
      setDownloading(true);
      const link = await getProtocolFileDownload(activeProtocolId);
      window.open(link.url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const handlePassportDownload = async () => {
    if (!activeProtocolId) return;
    try {
      setDownloadingPassport(true);
      const link = await getProtocolPassportDownload(activeProtocolId);
      window.open(link.url, '_blank');
    } finally {
      setDownloadingPassport(false);
    }
  };

  const handleExtraFileDownload = async (fileId: string) => {
    if (!activeProtocolId) return;
    try {
      setDownloadingFileId(fileId);
      const link = await getProtocolExtraFileDownload(activeProtocolId, fileId);
      window.open(link.url, '_blank');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleExportDocx = async () => {
    if (!activeProtocolId) return;
    try {
      setExportingDocx(true);
      const lang = (['uz', 'ru', 'en'].includes(i18n.language) ? i18n.language : 'uz') as
        | 'uz'
        | 'ru'
        | 'en';
      const blob = await exportProtocolDocx(activeProtocolId, lang);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protocol-${activeProtocolId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!activeProtocolId) return;
    await rejectMutation.mutateAsync({ id: activeProtocolId, input: { reason } });
    setIsRejectModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {t('protocols.title', 'Tahlil protokoli')}
          </h3>
        </div>
        <div className="py-8 text-center">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  // Protokol hali mavjud bo'lmasa (masalan, biriktirilmagan namuna)
  if (!protocols || protocols.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {t('protocols.title', 'Tahlil protokoli')}
          </h3>
        </div>
        <div className="mt-4 text-center py-8 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          <p className="text-sm text-slate-500">
            {sample.status === 'pending_assignment'
              ? t(
                  'protocols.pendingAssignmentNotice',
                  'Namuna kimyogarga biriktirilgach tahlil protokoli avtomatik yaratiladi.',
                )
              : t('protocols.noProtocolsNotice', 'Ushbu namunada protokollar topilmadi.')}
          </p>
        </div>
      </div>
    );
  }

  // Pasport bloki (universal render)
  const renderPassportBlock = () => {
    if (!activeProto) return null;
    const hasPassport = Boolean(activeProto.passportFilePath);

    return (
      <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {t('protocols.passportTitle', 'Protokol pasporti')}
            </h4>
            <p className="text-xs text-slate-400">
              {t('protocols.passportDesc', 'Qo‘shimcha tasdiqlanmagan holatsiz hujjat')}
            </p>
          </div>
          {hasPassport ? (
            <span className="text-xs text-emerald-600 font-medium">
              {t('protocols.passportUploaded', 'Pasport biriktirilgan')}
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              {t('protocols.passportMissing', 'Pasport yuklanmagan')}
            </span>
          )}
        </div>

        {hasPassport && activeProto.passportFileName ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {activeProto.passportFileName}
              </p>
              {activeProto.passportFileSize && (
                <p className="text-xs text-slate-500">
                  {`${(activeProto.passportFileSize / 1024).toFixed(1)} KB`}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePassportDownload}
                disabled={downloadingPassport}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {t('common.download', 'Yuklab olish')}
              </button>

              {canUploadPassport && (
                <>
                  <input
                    ref={passportInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handlePassportChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => passportInputRef.current?.click()}
                    disabled={uploadPassportMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    {t('common.replace', 'Almashtirish')}
                  </button>
                </>
              )}

              {canDeletePassport && (
                <button
                  type="button"
                  onClick={() => deletePassportMutation.mutate(activeProto.id)}
                  disabled={deletePassportMutation.isPending}
                  className="px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                >
                  {t('common.delete', 'O‘chirish')}
                </button>
              )}
            </div>
          </div>
        ) : canUploadPassport ? (
          <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg space-y-2">
            <input
              ref={passportInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handlePassportChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => passportInputRef.current?.click()}
              disabled={uploadPassportMutation.isPending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              {t('protocols.uploadPassportBtn', 'Protokol pasportini yuklash')}
            </button>
            <p className="text-xs text-slate-400">
              {t('protocols.fileHints', 'PDF, Word (.docx, .doc), PNG, JPEG (maksimal 20 MB)')}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            {t('protocols.passportMissing', 'Pasport yuklanmagan')}
          </p>
        )}
      </div>
    );
  };

  // KONTROLYOR: FAQAT pasport blokini ko'radi (Qoida 5)
  if (isKontrolyor) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {t('protocols.title', 'Tahlil protokoli')}
          </h3>
        </div>

        {protocols.length > 1 && (
          <div className="flex space-x-2 border-b border-slate-200 pb-2">
            {protocols.map((p) => {
              const isSelected = p.id === activeProtocolId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProtocolId(p.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{roleLabels[p.protocolRole] ?? p.protocolRole}</span>
                </button>
              );
            })}
          </div>
        )}

        {isDetailLoading && !activeProtocolDetail ? (
          <div className="py-8 text-center">
            <Spinner size="sm" />
          </div>
        ) : (
          renderPassportBlock()
        )}
      </div>
    );
  }

  // Boshqa foydalanuvchilar uchun to'liq ko'rinish
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Sarlavha va Tablar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-semibold text-slate-900">
            {t('protocols.title', 'Tahlil protokoli')}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {protocols.length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {activeProtocolId && (
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={exportingDocx}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              title={t('protocols.exportDocx', 'DOCX yuklab olish')}
            >
              <span>{t('protocols.exportDocx', 'DOCX yuklab olish')}</span>
            </button>
          )}

          {canCreateInProcess && (
            <button
              type="button"
              onClick={() => createInProcessMutation.mutate()}
              disabled={createInProcessMutation.isPending}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span aria-hidden="true">+</span>
              <span>{t('protocols.createInProcess', 'Oraliq protokol qo‘shish')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Agar bir nechta protokol bo'lsa Tablar */}
      {protocols.length > 1 && (
        <div className="flex space-x-2 border-b border-slate-200 pb-2">
          {protocols.map((p) => {
            const isSelected = p.id === activeProtocolId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProtocolId(p.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{roleLabels[p.protocolRole] ?? p.protocolRole}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-white text-slate-600'
                  }`}
                >
                  {p.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isDetailLoading && !activeProtocolDetail ? (
        <div className="py-8 text-center">
          <Spinner size="sm" />
        </div>
      ) : activeProto ? (
        <div className="space-y-4">
          {/* Status va Meta Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50/70 rounded-lg border border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {roleLabels[activeProto.protocolRole] ?? activeProto.protocolRole}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  statusBadgeClasses[activeProto.status]
                }`}
              >
                {t(`protocols.status.${activeProto.status}`, activeProto.status)}
              </span>
            </div>
            {activeProto.createdAt && (
              <span className="text-xs text-slate-400">
                {t('common.created', 'Yaratilgan')}:{' '}
                {new Date(activeProto.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Rad etish sababi banner (agar rejected bo'lsa) */}
          {activeProto.status === 'rejected' && activeProto.rejectionReason && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                {t('protocols.rejectedNotice', 'Laboratoriya mudiri tomonidan rad etilgan')}
              </h4>
              <p className="text-sm font-medium">{activeProto.rejectionReason}</p>
              <p className="text-xs text-rose-600">
                {t(
                  'protocols.rejectionFixNotice',
                  'Faylni yangilang va protokolni qayta yuboring.',
                )}
              </p>
            </div>
          )}

          {/* 1. Asosiy Fayl qismi */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {t('protocols.mainFile', 'Asosiy tahlil hisoboti (majburiy)')}
              </h4>
              {activeProto.filePath ? (
                <span className="text-xs text-emerald-600 font-medium">
                  {t('protocols.fileUploaded', 'Fayl biriktirilgan')}
                </span>
              ) : (
                <span className="text-xs text-amber-600 font-medium">
                  {t('protocols.fileMissing', 'Fayl yuklanmagan')}
                </span>
              )}
            </div>

            {activeProto.filePath && activeProto.fileName ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {activeProto.fileName}
                  </p>
                  {activeProto.fileMime && (
                    <p className="text-xs text-slate-500">{activeProto.fileMime}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleMainDownload}
                    disabled={downloading}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {t('common.download', 'Yuklab olish')}
                  </button>

                  {canUploadMain && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={handleMainFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadFileMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        {t('common.replace', 'Almashtirish')}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFileMutation.mutate(activeProto.id)}
                        disabled={deleteFileMutation.isPending}
                        className="px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                      >
                        {t('common.delete', 'O‘chirish')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : canUploadMain ? (
              <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleMainFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFileMutation.isPending}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  {t('protocols.uploadFileBtn', 'Tahlil hisobot faylini yuklash')}
                </button>
                <p className="text-xs text-slate-400">
                  {t('protocols.fileHints', 'PDF, Word (.docx, .doc), PNG, JPEG (maksimal 20 MB)')}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                {t('protocols.noFileAttached', 'Fayl biriktirilmagan')}
              </p>
            )}
          </div>

          {/* 2. Protokol pasporti */}
          {renderPassportBlock()}

          {/* 3. Qo'shimcha fayllar ro'yxati (FAQAT finished_product uchun) */}
          {sample.type === 'finished_product' && (
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {t('protocols.extraFilesTitle', 'Qo‘shimcha fayllar (maksimal 10 ta)')}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    {extraFiles.length}/10
                  </span>
                </div>

                {canUploadExtraFiles && (
                  <div>
                    <input
                      ref={extraFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={handleExtraFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => extraFileInputRef.current?.click()}
                      disabled={uploadExtraFileMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      + {t('protocols.uploadExtraFileBtn', 'Qo‘shimcha fayl yuklash')}
                    </button>
                  </div>
                )}
              </div>

              {extraFiles.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  {t('protocols.extraFilesEmpty', 'Qo‘shimcha fayllar mavjud emas')}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                  {extraFiles.map((f) => {
                    const canDeleteThisFile =
                      (activeProto.status === 'draft' || activeProto.status === 'rejected') &&
                      (isLabHead || isAdmin || f.uploadedBy === user?.id);

                    return (
                      <div
                        key={f.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50/60"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {f.fileName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {`${(f.fileSize / 1024).toFixed(1)} KB • ${f.uploadedByName ?? f.uploadedBy} • ${new Date(f.createdAt).toLocaleString()}`}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleExtraFileDownload(f.id)}
                            disabled={downloadingFileId === f.id}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                          >
                            {t('common.download', 'Yuklab olish')}
                          </button>

                          {canDeleteThisFile && (
                            <button
                              type="button"
                              onClick={() =>
                                deleteExtraFileMutation.mutate({
                                  protocolId: activeProto.id,
                                  fileId: f.id,
                                })
                              }
                              disabled={deleteExtraFileMutation.isPending}
                              className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded transition-colors border border-rose-200"
                            >
                              {t('common.delete', 'O‘chirish')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Harakatlar Paneli (Action buttons) */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
            {/* Kimyogar: Yuborish */}
            {canSubmit && (
              <button
                type="button"
                onClick={() => submitMutation.mutate(activeProto.id)}
                disabled={!activeProto.filePath || submitMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                title={
                  !activeProto.filePath
                    ? t('protocols.uploadRequiredBeforeSubmit', 'Avval fayl yuklang')
                    : undefined
                }
              >
                {activeProto.status === 'rejected'
                  ? t('protocols.resubmit', 'Qayta yuborish')
                  : t('protocols.submit', 'Yuborish')}
              </button>
            )}

            {/* Lab Head: Tasdiqlash va Rad etish */}
            {canReview && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  {t('protocols.reject', 'Rad etish')}
                </button>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate(activeProto.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
                >
                  {t('protocols.approve', 'Tasdiqlash')}
                </button>
              </>
            )}

            {/* Direktor: Yakunlash */}
            {canFinalize && (
              <button
                type="button"
                onClick={() => finalizeMutation.mutate(activeProto.id)}
                disabled={finalizeMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm transition-colors"
              >
                {t('protocols.finalize', 'Yakunlash')}
              </button>
            )}
          </div>

          {/* Imzolar tarixi (Signatures) */}
          {activeProtocolDetail?.signatures && activeProtocolDetail.signatures.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {t('protocols.signaturesHistory', 'Elektron imzolar tarixi')}
              </h4>
              <div className="divide-y divide-slate-100 bg-slate-50/50 rounded-lg border border-slate-100">
                {activeProtocolDetail.signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900">
                        {sig.userFullName ?? sig.role}
                      </span>
                      <span className="text-slate-400">({sig.role})</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-medium uppercase">
                        {sig.action}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-slate-500 font-mono text-[11px]">
                      <span>{new Date(sig.signedAt).toLocaleString()}</span>
                      <span
                        className="text-slate-400 truncate max-w-[120px]"
                        title={`SHA-256: ${sig.signatureHash}`}
                      >
                        {sig.signatureHash.slice(0, 10)}…
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Rad etish modali */}
      <ProtocolRejectModal
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={rejectMutation.isPending}
      />
    </div>
  );
};
