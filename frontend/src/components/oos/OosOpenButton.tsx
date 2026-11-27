import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCreateOosMutation } from '@/hooks/useOos';
import { Alert, Button, FormField, Input, Modal, notify, Textarea } from '@/ui';
import { oosErrorText } from './format';

const EMPTY = { testName: '', resultValue: '', specLimit: '', unit: '', description: '' };
type Form = typeof EMPTY;

/**
 * P19: "OOS ochish" — namuna va protokol oldindan to'ldiriladi. OOS'ni INSON ochadi (natija me'yordan
 * chetda deb); AI hech qachon ochmaydi/yopmaydi. Muvaffaqiyatda ish sahifasiga o'tiladi.
 */
export function OosOpenButton({
  sampleId,
  protocolId,
}: {
  sampleId: string;
  protocolId?: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formId = useId();
  const create = useCreateOosMutation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const missing = (key: keyof Form) => submitted && !form[key].trim();
  const valid = Boolean(form.testName.trim() && form.resultValue.trim() && form.specLimit.trim());

  const close = () => {
    setOpen(false);
    setForm(EMPTY);
    setSubmitted(false);
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setError(null);
    create.mutate(
      {
        sampleId,
        ...(protocolId ? { protocolId } : {}),
        testName: form.testName.trim(),
        resultValue: form.resultValue.trim(),
        specLimit: form.specLimit.trim(),
        unit: form.unit.trim() || null,
        description: form.description.trim() || null,
      },
      {
        onSuccess: (c) => {
          notify.success(t('oos.open.created'));
          close();
          void navigate(`/oos/${c.id}`);
        },
        onError: (err) => setError(oosErrorText(err)),
      },
    );
  };

  const required = t('oos.open.required');

  return (
    <>
      <Button
        variant="danger-ghost"
        size="sm"
        leftIcon="alert-triangle"
        onClick={() => setOpen(true)}
      >
        {t('oos.open.button')}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={t('oos.open.title')}
        description={t('oos.open.description')}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={create.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={formId} loading={create.isPending}>
              {t('oos.open.submit')}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <FormField
            label={t('oos.fields.testName')}
            required
            error={missing('testName') ? required : undefined}
          >
            <Input value={form.testName} onChange={(e) => set('testName')(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              label={t('oos.fields.resultValue')}
              required
              error={missing('resultValue') ? required : undefined}
            >
              <Input
                value={form.resultValue}
                onChange={(e) => set('resultValue')(e.target.value)}
              />
            </FormField>
            <FormField
              label={t('oos.fields.specLimit')}
              required
              error={missing('specLimit') ? required : undefined}
            >
              <Input value={form.specLimit} onChange={(e) => set('specLimit')(e.target.value)} />
            </FormField>
            <FormField label={t('oos.fields.unit')}>
              <Input value={form.unit} onChange={(e) => set('unit')(e.target.value)} />
            </FormField>
          </div>
          <FormField label={t('oos.fields.description')}>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
            />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
