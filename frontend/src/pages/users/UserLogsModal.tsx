import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserLogsQuery } from '@/hooks/useAdminUsers';
import type { AdminUserDto, UserAuditLogDto } from '@/types';
import { Button, DataTable, type DataTableColumn, Modal, Pagination } from '@/ui';
import { formatDateTime } from '@/lib/date';
import { ActionBadge } from '../audit/logsShared';

interface UserLogsModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserDto | null;
}

export function UserLogsModal({ open, onClose, user }: UserLogsModalProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useUserLogsQuery(user?.id ?? '', {
    page,
    limit: 10,
  });

  if (!user) return null;

  const columns: DataTableColumn<UserAuditLogDto>[] = [
    {
      key: 'action',
      header: t('users.logsModal.action'),
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'tableName',
      header: t('users.logsModal.table'),
      primary: true,
      render: (row) => (
        <span className="font-mono text-xs text-fg">
          {t(`audit.resources.${row.tableName}`, { defaultValue: row.tableName })}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('users.logsModal.time'),
      render: (row) => (
        <span className="text-xs tabular-nums text-fg-muted">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: t('users.logsModal.ip'),
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-xs text-fg-subtle">{row.ipAddress ?? '—'}</span>
      ),
    },
    {
      key: 'details',
      header: t('users.logsModal.details'),
      hideOnMobile: true,
      render: (row) => {
        const details = row.newValues ?? row.oldValues;
        return details ? (
          <code className="block max-w-xs truncate text-xs text-fg-muted">
            {JSON.stringify(details)}
          </code>
        ) : (
          '—'
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('users.logsModal.title')}
      description={`${user.fullName} (${user.email})`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={isError}
        onRetry={() => void refetch()}
        emptyText={t('users.logsModal.noLogs')}
      />
      {data?.meta && data.meta.total > 10 && <Pagination meta={data.meta} onPageChange={setPage} />}
    </Modal>
  );
}
