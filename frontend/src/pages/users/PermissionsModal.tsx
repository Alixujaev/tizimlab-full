import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  usePermissionsCatalogQuery,
  useSetUserPermissionsMutation,
  useUserPermissionsQuery,
} from '@/hooks/useAdminUsers';
import type { AdminUserDto } from '@/types';

interface PermissionsModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserDto | null;
}

export function PermissionsModal({ open, onClose, user }: PermissionsModalProps) {
  const { t } = useTranslation();

  const userId = user?.id ?? '';
  const catalogQuery = usePermissionsCatalogQuery();
  const userPermsQuery = useUserPermissionsQuery(userId);
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

  // Group items by their resource prefix (e.g. 'samples' from 'samples:create')
  const groupedItems = catalog.reduce<Record<string, string[]>>((acc, permKey) => {
    const resource = permKey.split(':')[0] ?? 'other';
    const list = acc[resource] ?? [];
    list.push(permKey);
    acc[resource] = list;
    return acc;
  }, {});

  const handleToggle = (permKey: string) => {
    setSelectedGrants((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey],
    );
  };

  const handleSave = () => {
    setGeneralError(undefined);
    setPermsMutation.mutate(
      { id: user.id, permissions: selectedGrants },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            onClose();
          }, 1000);
        },
        onError: (err) => {
          const apiError = toApiError(err);
          setGeneralError(apiError?.message ?? t('errors.generic'));
        },
      },
    );
  };

  const isLoading = catalogQuery.isLoading || userPermsQuery.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.permissionsModal.title')}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={setPermsMutation.isPending}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('companies.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={setPermsMutation.isPending || isLoading || success}
            className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {setPermsMutation.isPending && <Spinner size="sm" />}
            {setPermsMutation.isPending
              ? t('users.permissionsModal.saving')
              : t('users.permissionsModal.save')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-900">
            {t('users.permissionsModal.user')}: {user.fullName} ({user.email})
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {t('users.permissionsModal.roleNotice')}
          </p>
          <p className="text-xs text-slate-600">
            {t('users.permissionsModal.grantNotice')}
          </p>
        </div>

        {generalError && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {generalError}
          </div>
        )}

        {success && (
          <div role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            {t('users.permissionsModal.success')}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
            {Object.entries(groupedItems).map(([group, permKeys]) => (
              <div key={group} className="rounded-md border border-slate-200 p-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t(`permissions.groups.${group}`)}
                </h4>
                <div className="space-y-2">
                  {permKeys.map((permKey) => {
                    const isRoleDefault = rolePermissions.includes(permKey);
                    const isChecked = isRoleDefault || selectedGrants.includes(permKey);

                    return (
                      <label
                        key={permKey}
                        className={`flex items-center justify-between rounded p-1.5 text-sm hover:bg-slate-50 ${
                          isRoleDefault ? 'cursor-default opacity-80' : 'cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isRoleDefault || setPermsMutation.isPending}
                            onChange={() => !isRoleDefault && handleToggle(permKey)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                          />
                          <span className="text-slate-800">
                            {t(`permissions.items.${permKey}`)}
                          </span>
                        </div>

                        {isRoleDefault ? (
                          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {t('users.permissionsModal.roleDefault')}
                          </span>
                        ) : selectedGrants.includes(permKey) ? (
                          <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {t('users.permissionsModal.customGrant')}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
