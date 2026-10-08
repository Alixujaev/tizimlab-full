import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useCreateUserMutation, useUpdateUserMutation } from '@/hooks/useAdminUsers';
import { EMAIL_REGEX, isPasswordValid } from '@/lib/validation';
import type { AdminUserDto, CompanyUserRole, Role } from '@/types';

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
  role?: string;
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
  const isEdit = Boolean(user);
  const isSelf = user?.id === currentUserId;

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const allowedRoles: CompanyUserRole[] = useMemo(() => {
    if (currentUserRole === 'lab_head') {
      return ['chemist', 'kontrolyor'];
    }
    return ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin'];
  }, [currentUserRole]);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CompanyUserRole>(allowedRoles[0] ?? 'chemist');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (user) {
        setEmail(user.email);
        setFullName(user.fullName);
        setRole(user.role as CompanyUserRole);
        setIsActive(user.isActive);
      } else {
        setEmail('');
        setFullName('');
        setRole(allowedRoles[0] ?? 'chemist');
        setPassword('');
        setIsActive(true);
      }
      setErrors({});
    }
  }, [open, user, allowedRoles]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};

    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) {
      newErrors.fullName = t('users.errors.fullNameRequired');
    }

    if (!isEdit) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        newErrors.email = t('users.errors.emailRequired');
      } else if (!EMAIL_REGEX.test(trimmedEmail)) {
        newErrors.email = t('auth.validation.emailInvalid');
      }

      if (!password) {
        newErrors.password = t('users.errors.passwordRequired');
      } else if (!isPasswordValid(password)) {
        newErrors.password = t('users.errors.passwordPolicy');
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

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
        {
          email: email.trim().toLowerCase(),
          fullName: trimmedFullName,
          role,
          password,
        },
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

  const title = isEdit ? t('users.editUser') : t('users.createUser');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('companies.cancel')}
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isPending && <Spinner size="sm" />}
            {isPending ? t('users.form.saving') : t('users.form.save')}
          </button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="user-full-name" className="block text-sm font-medium text-slate-700">
            {t('users.form.fullName')}
          </label>
          <input
            id="user-full-name"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
        </div>

        <div>
          <label htmlFor="user-email" className="block text-sm font-medium text-slate-700">
            {t('users.form.email')}
          </label>
          <input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            disabled={isPending || isEdit}
            className={`mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
            }`}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="user-role" className="block text-sm font-medium text-slate-700">
            {t('users.form.role')}
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as CompanyUserRole)}
            disabled={isPending || isSelf}
            className={`mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isSelf ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
            }`}
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {t(`users.roles.${r}`)}
              </option>
            ))}
          </select>
          {isSelf && (
            <p className="mt-1 text-xs text-slate-500">
              {t('users.errors.cannotDeactivateSelf')}
            </p>
          )}
        </div>

        {!isEdit && (
          <div>
            <label htmlFor="user-password" className="block text-sm font-medium text-slate-700">
              {t('users.form.password')}
            </label>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">{t('users.errors.passwordPolicy')}</p>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
        )}

        {isEdit && (
          <div>
            <label htmlFor="user-status" className="block text-sm font-medium text-slate-700">
              {t('users.form.status')}
            </label>
            <select
              id="user-status"
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              disabled={isPending || isSelf}
              className={`mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isSelf ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
              }`}
            >
              <option value="active">{t('users.form.active')}</option>
              <option value="inactive">{t('users.form.inactive')}</option>
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}
