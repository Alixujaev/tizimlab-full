import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUploadDocumentMutation } from '@/hooks/useReagents';
import { errorMessage } from '@/lib/queryClient';
import type { ReagentDocType } from '@/types';
import { Alert, Button, FileDropzone, FormField, Input, Modal, Select } from '@/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  reagentId: string;
}

const DOC_TYPES: ReagentDocType[] = ['passport', 'analysis_result', 'other'];

interface FieldErrors {
  title?: string;
  file?: string;
}

export function ReagentDocumentModal({ open, onClose, reagentId }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const uploadMutation = useUploadDocumentMutation();
  const [docType, setDocType] = useState<ReagentDocType>('passport');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!title.trim()) next.title = t('reagents.docTitleRequired', 'Hujjat nomi kiritilishi shart');
    if (!file) next.file = t('reagents.fileRequired', 'Fayl tanlanishi shart');
    setFieldErrors(next);
    if (next.title || !file) return;

    try {
      await uploadMutation.mutateAsync({ reagentId, docType, title: title.trim(), file });
      setTitle('');
      setFile(null);
      setError(null);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('reagents.uploadDocument')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploadMutation.isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button type="submit" form={formId} leftIcon="upload" loading={uploadMutation.isPending}>
            {t('reagents.uploadDocument')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label={t('reagents.docType')} required>
          <Select
            options={DOC_TYPES.map((v) => ({ value: v, label: t(`reagents.docTypes.${v}`) }))}
            value={docType}
            onChange={setDocType}
          />
        </FormField>
        <FormField label={t('reagents.docTitle')} required error={fieldErrors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label={t('reagents.file')} required error={fieldErrors.file}>
          <FileDropzone
            value={file}
            onChange={(selected) => {
              setFile(selected);
              // Nom bo'sh bo'lsa — fayl nomidan (kengaytmasiz) taklif
              if (selected && !title) setTitle(selected.name.replace(/\.[^/.]+$/, ''));
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}
