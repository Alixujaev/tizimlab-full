import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsersQuery } from '@/hooks/useAdminUsers';
import { useCreateCheckpointMutation } from '@/hooks/useStability';
import { errorMessage } from '@/lib/queryClient';
import { Alert, Button, DatePicker, FormField, Input, Modal, Select, Textarea } from '@/ui';

interface CreateCheckpointModalProps {
  studyId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface FieldErrors {
  intervalTag?: string;
  dueDate?: string;
}

export function CreateCheckpointModal({ studyId, isOpen, onClose }: CreateCheckpointModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useCreateCheckpointMutation(studyId);
  const [intervalTag, setIntervalTag] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  // D-53 (R-STAB-30): checkpointga mas'ul kimyogar — natijani faqat u kirita oladi (backend majburlaydi)
  const [assignedTo, setAssignedTo] = useState('');
  const { data: chemistsData } = useUsersQuery(
    { role: 'chemist', isActive: true, limit: 100 },
    { enabled: isOpen },
  );
  const chemists = chemistsData?.data ?? [];
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: FieldErrors = {};
    if (!intervalTag.trim())
      next.intervalTag = t('stability.checkpointNameRequired', 'Checkpoint nomi kiritilishi shart');
    if (!dueDate) next.dueDate = t('stability.dueDateRequired', 'Sana kiritilishi shart');
    setFieldErrors(next);
    if (next.intervalTag || next.dueDate) return;
    try {
      await mutation.mutateAsync({
        intervalTag: intervalTag.trim(),
        dueDate,
        assignedTo: assignedTo || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title={t('stability.addCheckpoint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('stability.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {t('stability.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label={t('stability.checkpointName')} required error={fieldErrors.intervalTag}>
          <Input
            value={intervalTag}
            onChange={(e) => setIntervalTag(e.target.value)}
            placeholder={t('stability.checkpointNamePlaceholder')}
          />
        </FormField>
        <FormField label={t('stability.dueDate')} required error={fieldErrors.dueDate}>
          <DatePicker value={dueDate} onChange={setDueDate} />
        </FormField>
        <FormField label={t('stability.assignedTo')}>
          <Select
            options={[
              { value: '', label: t('stability.noAssignee') },
              ...chemists.map((ch) => ({ value: ch.id, label: ch.fullName })),
            ]}
            value={assignedTo}
            onChange={setAssignedTo}
          />
        </FormField>
        <FormField label={t('stability.notes')}>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('stability.notesPlaceholder')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
