import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import {
  usePermissionsCatalogQuery,
  useSetUserPermissionsMutation,
  useUserPermissionsQuery,
} from '@/hooks/useAdminUsers';
import type { AdminUserDto } from '@/types';
import { Alert, Badge, Button, Checkbox, Modal, Skeleton } from '@/ui';

interface PermissionsModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserDto | null;
}

export function PermissionsModal({ open, onClose, user }: PermissionsModalProps) {
  const { t } = useTranslation();
  const catalogQuery = usePermissionsCatalogQuery();
  const userPermsQuery = useUserPermissionsQuery(user?.id ?? '');
  const setPermsMutation = useSetUserPermissionsMutation();
  const [selectedGrants, setSelectedGrants] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && userPermsQuery.data) {
      setSelectedGrants([...userPermsQuery.data.individualPermissions]);
      setGeneralError(undefined);
      setSuccess(false);
    }
  }, [open, userPermsQuery.data]);

  if (!user) return null;

  const catalog = catalogQuery.data?.catalog ?? [];
  const rolePermissions = userPermsQuery.data?.rolePermissions ?? [];
  // Ruxsatlar resurs bo'yicha guruhlanadi ('samples:create' → 'samples')
  const grouped = catalog.reduce<Record<string, string[]>>((acc, key) => {
    const resource = key.split(':')[0] ?? 'other';
    (acc[resource] ??= []).push(key);
    return acc;
  }, {});
  const isLoading = catalogQuery.isLoading || userPermsQuery.isLoading;

  const toggle = (key: string) =>
    setSelectedGrants((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const handleSave = () => {
    setGeneralError(undefined);
    setPermsMutation.mutate(
      { id: user.id, permissions: selectedGrants },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(onClose, 1000);
        },
        onError: (err) => setGeneralError(toApiError(err)?.message ?? t('errors.generic')),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('users.permissionsModal.title')}
      description={`${t('users.permissionsModal.user')}: ${user.fullName} (${user.email})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setPermsMutation.isPending}>
            {t('companies.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            loading={setPermsMutation.isPending}
            disabled={isLoading || success}
          >
            {setPermsMutation.isPending
              ? t('users.permissionsModal.saving')
              : t('users.permissionsModal.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info">
          <p>{t('users.permissionsModal.roleNotice')}</p>
          <p>{t('users.permissionsModal.grantNotice')}</p>
        </Alert>
        {generalError && <Alert tone="danger">{generalError}</Alert>}
        {success && <Alert tone="success">{t('users.permissionsModal.success')}</Alert>}
        {isLoading ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">{t('common.loading')}</span>
            <Skeleton variant="rect" className="h-24 w-full" />
            <Skeleton variant="rect" className="h-24 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(grouped).map(([group, keys]) => (
              <fieldset key={group} className="rounded-lg border border-line p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {t(`permissions.groups.${group}`)}
                </legend>
                <ul className="flex flex-col gap-1">
                  {keys.map((key) => {
                    const isRoleDefault = rolePermissions.includes(key);
                    const isGranted = selectedGrants.includes(key);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 hover:bg-surface-muted"
                      >
                        <Checkbox
                          label={t(`permissions.items.${key}`)}
                          checked={isRoleDefault || isGranted}
                          disabled={isRoleDefault || setPermsMutation.isPending}
                          onChange={() => !isRoleDefault && toggle(key)}
                        />
                        {isRoleDefault ? (
                          <Badge size="sm">{t('users.permissionsModal.roleDefault')}</Badge>
                        ) : isGranted ? (
                          <Badge size="sm" tone="primary">
                            {t('users.permissionsModal.customGrant')}
                          </Badge>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
