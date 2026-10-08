import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { type Column, Table } from '@/components/ui/Table';
import { useUserLogsQuery } from '@/hooks/useAdminUsers';
import type { AdminUserDto, UserAuditLogDto } from '@/types';

interface UserLogsModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserDto | null;
}

export function UserLogsModal({ open, onClose, user }: UserLogsModalProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const userId = user?.id ?? '';
  const { data, isLoading } = useUserLogsQuery(userId, { page, limit: 10 });

  if (!user) return null;

  const logs = data?.data ?? [];

  const columns: Column<UserAuditLogDto>[] = [
    {
      key: 'action',
      header: t('users.logsModal.action'),
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">{row.action}</span>
      ),
    },
    {
      key: 'tableName',
      header: t('users.logsModal.table'),
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">{row.tableName}</span>
      ),
    },
    {
      key: 'createdAt',
      header: t('users.logsModal.time'),
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: t('users.logsModal.ip'),
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{row.ipAddress ?? '-'}</span>
      ),
    },
    {
      key: 'details',
      header: t('users.logsModal.details'),
      render: (row) => {
        const details = row.newValues ?? row.oldValues;
        if (!details) return <span className="text-slate-400">-</span>;
        return (
          <code className="block max-w-xs truncate text-xs text-slate-600">
            {JSON.stringify(details)}
          </code>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.logsModal.title')}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-900">
            {user.fullName} ({user.email})
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              rows={logs}
              rowKey={(r) => r.id}
              emptyText={t('users.logsModal.noLogs')}
            />
            {data?.meta && data.meta.total > 10 && (
              <div className="flex justify-end">
                <Pagination meta={data.meta} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
