import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useResetPasswordMutation } from '@/hooks/useAdminUsers';
import { isPasswordValid } from '@/lib/validation';
import type { AdminUserDto } from '@/types';
import { Alert, Button, FormField, Input, Modal } from '@/ui';

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserDto | null;
}

export function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const resetMutation = useResetPasswordMutation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [generalError, setGeneralError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(undefined);
    setGeneralError(undefined);
    setSuccess(false);
  }, [open]);

  if (!user) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(undefined);
    setGeneralError(undefined);
    if (!newPassword) return setPasswordError(t('users.errors.passwordRequired'));
    if (!isPasswordValid(newPassword)) return setPasswordError(t('users.errors.passwordPolicy'));
    if (newPassword !== confirmPassword)
      return setPasswordError(t('users.errors.passwordMismatch'));

    resetMutation.mutate(
      { id: user.id, input: { newPassword } },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(onClose, 1200);
        },
        onError: (err) => setGeneralError(toApiError(err)?.message ?? t('errors.generic')),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.resetModal.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={resetMutation.isPending}>
            {t('companies.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={resetMutation.isPending} disabled={success}>
            {resetMutation.isPending
              ? t('users.resetModal.submitting')
              : t('users.resetModal.submit')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Alert tone="warning" title={`${user.fullName} (${user.email})`}>
          {t('users.resetModal.warning')}
        </Alert>
        {generalError && <Alert tone="danger">{generalError}</Alert>}
        {success && <Alert tone="success">{t('users.resetModal.success')}</Alert>}
        <FormField
          id="reset-new-password"
          label={t('users.resetModal.newPassword')}
          disabled={resetMutation.isPending}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError(undefined);
            }}
          />
        </FormField>
        <FormField
          id="reset-confirm-password"
          label={t('users.resetModal.confirmPassword')}
          error={passwordError}
          disabled={resetMutation.isPending}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError(undefined);
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}
