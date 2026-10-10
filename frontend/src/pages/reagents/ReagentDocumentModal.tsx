import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useUploadDocumentMutation } from '@/hooks/useReagents';
import type { ReagentDocType } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  reagentId: string;
}

export function ReagentDocumentModal({ open, onClose, reagentId }: Props) {
  const { t } = useTranslation();
  const uploadMutation = useUploadDocumentMutation();

  const [docType, setDocType] = useState<ReagentDocType>('passport');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('reagents.docTitleRequired', 'Hujjat nomi kiritilishi shart'));
      return;
    }
    if (!file) {
      setError(t('reagents.fileRequired', 'Fayl tanlanishi shart'));
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError(t('reagents.fileTooLarge', 'Fayl hajmi 20MB dan oshmasligi kerak'));
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        reagentId,
        docType,
        title: title.trim(),
        file,
      });
      setTitle('');
      setFile(null);
      setError(null);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.uploadError', 'Fayl yuklashda xatolik yuz berdi');
      setError(msg);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('reagents.uploadDocument')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.docType')} *
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as ReagentDocType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="passport">{t('reagents.docTypes.passport')}</option>
            <option value="analysis_result">{t('reagents.docTypes.analysis_result')}</option>
            <option value="other">{t('reagents.docTypes.other')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.docTitle')} *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {t('reagents.file')} *
          </label>
          <input
            type="file"
            required
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              setFile(selected);
              if (selected && !title) {
                const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, "");
                setTitle(nameWithoutExt);
              }
            }}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={uploadMutation.isPending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {t('common.cancel', 'Bekor qilish')}
          </button>
          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {uploadMutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            {t('common.save', 'Yuklash')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
