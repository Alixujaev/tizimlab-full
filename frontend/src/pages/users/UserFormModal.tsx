import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useCreateUserMutation, useUpdateUserMutation } from '@/hooks/useAdminUsers';
import { EMAIL_REGEX, isPasswordValid } from '@/lib/validation';
import type { AdminUserDto, CompanyUserRole, Role } from '@/types';
import { Alert, Button, FormField, Input, Modal, Select, Switch } from '@/ui';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user?: AdminUserDto | null;
  currentUserRole: Role;
  currentUserId: string;
}

interface FormErrors {
  email?: string;
  fullName?: string;
  password?: string;
  general?: string;
}

export function UserFormModal({
  open,
  onClose,
  user,
  currentUserRole,
  currentUserId,
}: UserFormModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const isEdit = Boolean(user);
  const isSelf = user?.id === currentUserId;
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const allowedRoles: CompanyUserRole[] = useMemo(
    () =>
      currentUserRole === 'lab_head'
        ? ['chemist', 'kontrolyor']
        : ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin'],
    [currentUserRole],
  );

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CompanyUserRole>(allowedRoles[0] ?? 'chemist');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    setEmail(user?.email ?? '');
    setFullName(user?.fullName ?? '');
    setRole((user?.role as CompanyUserRole) ?? allowedRoles[0] ?? 'chemist');
    setPassword('');
    setIsActive(user?.isActive ?? true);
    setErrors({});
  }, [open, user, allowedRoles]);

  const clearError = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) next.fullName = t('users.errors.fullNameRequired');
    if (!isEdit) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) next.email = t('users.errors.emailRequired');
      else if (!EMAIL_REGEX.test(trimmedEmail)) next.email = t('auth.validation.emailInvalid');
      if (!password) next.password = t('users.errors.passwordRequired');
      else if (!isPasswordValid(password)) next.password = t('users.errors.passwordPolicy');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (isEdit && user) {
      updateMutation.mutate(
        {
          id: user.id,
          input: {
            fullName: trimmedFullName,
            role: isSelf ? undefined : role,
            isActive: isSelf ? undefined : isActive,
          },
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const apiError = toApiError(err);
            const msg = apiError?.message?.toLowerCase() ?? '';
            if (msg.includes('kamida bitta faol administrator') || msg.includes('oxirgi')) {
              setErrors({ general: t('users.errors.cannotDeactivateLastAdmin') });
            } else if (msg.includes("o'z hisobingizni")) {
              setErrors({ general: t('users.errors.cannotDeactivateSelf') });
            } else {
              setErrors({ general: apiError?.message ?? t('errors.generic') });
            }
          },
        },
      );
    } else {
      createMutation.mutate(
        { email: email.trim().toLowerCase(), fullName: trimmedFullName, role, password },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const apiError = toApiError(err);
            const msg = apiError?.message?.toLowerCase() ?? '';
            if (msg.includes('email') || apiError?.code === 'CONFLICT') {
              setErrors({ email: t('users.errors.emailExists') });
            } else {
              setErrors({ general: apiError?.message ?? t('errors.generic') });
            }
          },
        },
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('users.editUser') : t('users.createUser')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {t('companies.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={isPending}>
            {isPending ? t('users.form.saving') : t('users.form.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.general && <Alert tone="danger">{errors.general}</Alert>}

        <FormField
          id="user-full-name"
          label={t('users.form.fullName')}
          error={errors.fullName}
          disabled={isPending}
        >
          <Input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clearError('fullName');
            }}
          />
        </FormField>

        <FormField
          id="user-email"
          label={t('users.form.email')}
          error={errors.email}
          disabled={isPending || isEdit}
        >
          <Input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
          />
        </FormField>

        <FormField
          id="user-role"
          label={t('users.form.role')}
          disabled={isPending || isSelf}
          hint={isSelf ? t('users.errors.cannotDeactivateSelf') : undefined}
        >
          <Select
            options={allowedRoles.map((r) => ({ value: r, label: t(`users.roles.${r}`) }))}
            value={role}
            onChange={setRole}
          />
        </FormField>

        {!isEdit && (
          <FormField
            id="user-password"
            label={t('users.form.password')}
            error={errors.password}
            hint={t('users.errors.passwordPolicy')}
            disabled={isPending}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError('password');
              }}
            />
          </FormField>
        )}

        {isEdit && (
          <Switch
            label={t('users.form.status')}
            description={isActive ? t('users.form.active') : t('users.form.inactive')}
            checked={isActive}
            disabled={isPending || isSelf}
            onChange={setIsActive}
          />
        )}
      </form>
    </Modal>
  );
}
