import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { useCreateCompanyMutation, useUpdateCompanyMutation } from '@/hooks/useCompanies';
import { EMAIL_REGEX, isPasswordValid, SLUG_REGEX } from '@/lib/validation';
import type { CompanyDto } from '@/types';
import { Alert, Button, FormField, Input, Modal } from '@/ui';

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
  const formId = useId();
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
    if (!open) return;
    setName(company?.name ?? '');
    setSlug(company?.slug ?? '');
    setAdminEmail('');
    setAdminFullName('');
    setAdminPassword('');
    setErrors({});
  }, [open, company]);

  const clear = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();
    if (!trimmedName) next.name = t('companies.errors.nameRequired');
    if (!trimmedSlug) next.slug = t('companies.errors.slugRequired');
    else if (!SLUG_REGEX.test(trimmedSlug) || trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      next.slug = t('companies.errors.slugInvalid');
    }
    if (!isEdit) {
      const email = adminEmail.trim().toLowerCase();
      if (!email) next.adminEmail = t('companies.errors.adminEmailRequired');
      else if (!EMAIL_REGEX.test(email)) next.adminEmail = t('auth.validation.emailInvalid');
      if (!adminFullName.trim()) next.adminFullName = t('companies.errors.adminFullNameRequired');
      if (!adminPassword) next.adminPassword = t('companies.errors.adminPasswordRequired');
      else if (!isPasswordValid(adminPassword))
        next.adminPassword = t('users.errors.passwordPolicy');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const onError = (err: unknown) => {
      const apiError = toApiError(err);
      const msg = apiError?.message?.toLowerCase() ?? '';
      if (msg.includes('slug')) setErrors({ slug: t('companies.errors.slugExists') });
      else if (!isEdit && msg.includes('email'))
        setErrors({ adminEmail: t('companies.errors.emailExists') });
      else setErrors({ general: apiError?.message ?? t('errors.generic') });
    };

    if (isEdit && company) {
      updateMutation.mutate(
        { id: company.id, input: { name: trimmedName, slug: trimmedSlug } },
        { onSuccess: () => onClose(), onError },
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
        { onSuccess: () => onClose(), onError },
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('companies.editCompany') : t('companies.createCompany')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {t('companies.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={isPending}>
            {isPending ? t('companies.form.saving') : t('companies.form.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.general && <Alert tone="danger">{errors.general}</Alert>}
        <FormField
          id="company-name"
          label={t('companies.form.companyName')}
          error={errors.name}
          disabled={isPending}
        >
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clear('name');
            }}
          />
        </FormField>
        <FormField
          id="company-slug"
          label={t('companies.form.slug')}
          hint={t('companies.form.slugHint')}
          error={errors.slug}
          disabled={isPending}
        >
          <Input
            className="font-mono"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              clear('slug');
            }}
          />
        </FormField>

        {!isEdit && (
          <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
            <legend className="mb-1 text-sm font-semibold text-fg">
              {t('companies.form.adminSection')}
            </legend>
            <FormField
              id="admin-full-name"
              label={t('companies.form.adminFullName')}
              error={errors.adminFullName}
              disabled={isPending}
            >
              <Input
                value={adminFullName}
                onChange={(e) => {
                  setAdminFullName(e.target.value);
                  clear('adminFullName');
                }}
              />
            </FormField>
            <FormField
              id="admin-email"
              label={t('companies.form.adminEmail')}
              error={errors.adminEmail}
              disabled={isPending}
            >
              <Input
                type="email"
                autoComplete="off"
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value);
                  clear('adminEmail');
                }}
              />
            </FormField>
            <FormField
              id="admin-password"
              label={t('companies.form.adminPassword')}
              error={errors.adminPassword}
              disabled={isPending}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  clear('adminPassword');
                }}
              />
            </FormField>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
