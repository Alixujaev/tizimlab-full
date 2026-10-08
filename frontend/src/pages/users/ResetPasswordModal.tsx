import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useResetPasswordMutation } from '@/hooks/useAdminUsers';
import { isPasswordValid } from '@/lib/validation';
import type { AdminUserDto } from '@/types';

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserDto | null;
}

export function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps) {
  const { t } = useTranslation();
  const resetMutation = useResetPasswordMutation();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [generalError, setGeneralError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(undefined);
      setGeneralError(undefined);
      setSuccess(false);
    }
  }, [open]);

  if (!user) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(undefined);
    setGeneralError(undefined);

    if (!newPassword) {
      setPasswordError(t('users.errors.passwordRequired'));
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setPasswordError(t('users.errors.passwordPolicy'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('users.errors.passwordMismatch'));
      return;
    }

    resetMutation.mutate(
      { id: user.id, input: { newPassword } },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            onClose();
          }, 1200);
        },
        onError: (err) => {
          const apiError = toApiError(err);
          setGeneralError(apiError?.message ?? t('errors.generic'));
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.resetModal.title')}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={resetMutation.isPending}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('companies.cancel')}
          </button>
          <button
            type="submit"
            form="reset-password-form"
            disabled={resetMutation.isPending || success}
            className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {resetMutation.isPending && <Spinner size="sm" />}
            {resetMutation.isPending
              ? t('users.resetModal.submitting')
              : t('users.resetModal.submit')}
          </button>
        </div>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">{user.fullName} ({user.email})</p>
          <p className="mt-1 text-xs">{t('users.resetModal.warning')}</p>
        </div>

        {generalError && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {generalError}
          </div>
        )}

        {success && (
          <div role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            {t('users.resetModal.success')}
          </div>
        )}

        <div>
          <label
            htmlFor="reset-new-password"
            className="block text-sm font-medium text-slate-700"
          >
            {t('users.resetModal.newPassword')}
          </label>
          <input
            id="reset-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError(undefined);
            }}
            disabled={resetMutation.isPending}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="reset-confirm-password"
            className="block text-sm font-medium text-slate-700"
          >
            {t('users.resetModal.confirmPassword')}
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError(undefined);
            }}
            disabled={resetMutation.isPending}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {passwordError && <p className="mt-1 text-xs text-red-600">{passwordError}</p>}
        </div>
      </form>
    </Modal>
  );
}
