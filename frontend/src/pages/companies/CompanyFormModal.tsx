import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useCreateCompanyMutation, useUpdateCompanyMutation } from '@/hooks/useCompanies';
import { EMAIL_REGEX, isPasswordValid, SLUG_REGEX } from '@/lib/validation';
import type { CompanyDto } from '@/types';

interface CompanyFormModalProps {
  open: boolean;
  onClose: () => void;
  company: CompanyDto | null;
}

interface FormErrors {
  name?: string;
  slug?: string;
  adminEmail?: string;
  adminFullName?: string;
  adminPassword?: string;
  general?: string;
}

export function CompanyFormModal({ open, onClose, company }: CompanyFormModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(company);

  const createMutation = useCreateCompanyMutation();
  const updateMutation = useUpdateCompanyMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (company) {
        setName(company.name);
        setSlug(company.slug);
      } else {
        setName('');
        setSlug('');
        setAdminEmail('');
        setAdminFullName('');
        setAdminPassword('');
      }
      setErrors({});
    }
  }, [open, company]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (!trimmedName) {
      newErrors.name = t('companies.errors.nameRequired');
    }

    if (!trimmedSlug) {
      newErrors.slug = t('companies.errors.slugRequired');
    } else if (!SLUG_REGEX.test(trimmedSlug) || trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      newErrors.slug = t('companies.errors.slugInvalid');
    }

    if (!isEdit) {
      const trimmedEmail = adminEmail.trim().toLowerCase();
      const trimmedFullName = adminFullName.trim();

      if (!trimmedEmail) {
        newErrors.adminEmail = t('companies.errors.adminEmailRequired');
      } else if (!EMAIL_REGEX.test(trimmedEmail)) {
        newErrors.adminEmail = t('auth.validation.emailInvalid');
      }

      if (!trimmedFullName) {
        newErrors.adminFullName = t('companies.errors.adminFullNameRequired');
      }

      if (!adminPassword) {
        newErrors.adminPassword = t('companies.errors.adminPasswordRequired');
      } else if (!isPasswordValid(adminPassword)) {
        newErrors.adminPassword = t('users.errors.passwordPolicy');
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (isEdit && company) {
      updateMutation.mutate(
        { id: company.id, input: { name: trimmedName, slug: trimmedSlug } },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const apiError = toApiError(err);
            const msg = apiError?.message?.toLowerCase() ?? '';
            if (msg.includes('slug')) {
              setErrors({ slug: t('companies.errors.slugExists') });
            } else {
              setErrors({ general: apiError?.message ?? t('errors.generic') });
            }
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          name: trimmedName,
          slug: trimmedSlug,
          admin: {
            email: adminEmail.trim().toLowerCase(),
            fullName: adminFullName.trim(),
            password: adminPassword,
          },
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const apiError = toApiError(err);
            const msg = apiError?.message?.toLowerCase() ?? '';
            if (msg.includes('slug')) {
              setErrors({ slug: t('companies.errors.slugExists') });
            } else if (msg.includes('email')) {
              setErrors({ adminEmail: t('companies.errors.emailExists') });
            } else {
              setErrors({ general: apiError?.message ?? t('errors.generic') });
            }
          },
        },
      );
    }
  };

  const title = isEdit ? t('companies.editCompany') : t('companies.createCompany');

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
            form="company-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isPending && <Spinner size="sm" />}
            {isPending ? t('companies.form.saving') : t('companies.form.save')}
          </button>
        </div>
      }
    >
      <form id="company-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-slate-700">
            {t('companies.form.companyName')}
          </label>
          <input
            id="company-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="company-slug" className="block text-sm font-medium text-slate-700">
            {t('companies.form.slug')}
          </label>
          <input
            id="company-slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
            }}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-500">{t('companies.form.slugHint')}</p>
          {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
        </div>

        {!isEdit && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              {t('companies.form.adminSection')}
            </h3>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="admin-full-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t('companies.form.adminFullName')}
                </label>
                <input
                  id="admin-full-name"
                  type="text"
                  value={adminFullName}
                  onChange={(e) => {
                    setAdminFullName(e.target.value);
                    if (errors.adminFullName) {
                      setErrors((prev) => ({ ...prev, adminFullName: undefined }));
                    }
                  }}
                  disabled={isPending}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.adminFullName && (
                  <p className="mt-1 text-xs text-red-600">{errors.adminFullName}</p>
                )}
              </div>

              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700">
                  {t('companies.form.adminEmail')}
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (errors.adminEmail) {
                      setErrors((prev) => ({ ...prev, adminEmail: undefined }));
                    }
                  }}
                  disabled={isPending}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.adminEmail && (
                  <p className="mt-1 text-xs text-red-600">{errors.adminEmail}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t('companies.form.adminPassword')}
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (errors.adminPassword) {
                      setErrors((prev) => ({ ...prev, adminPassword: undefined }));
                    }
                  }}
                  disabled={isPending}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.adminPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.adminPassword}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
