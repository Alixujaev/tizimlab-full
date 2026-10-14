import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditLogsQuery } from '@/hooks/useAudit';
import { useAuthStore } from '@/store/authStore';
import type { AuditLogDto } from '@/types';
import { Alert, DataTable, EmptyState, PageHeader, Pagination } from '@/ui';
import { LogDetailsModal } from './LogDetailsModal';
import { LogFilterBar, useLogColumns, useLogFilters } from './logsShared';

export function AuditLogPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const isAllowed = role === 'super_admin' || role === 'admin';
  const filters = useLogFilters();
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);
  // Ruxsatsiz rol uchun so'rov yuborilmaydi (403 qoidasi)
  const { data, isLoading, isError, refetch } = useAuditLogsQuery(filters.params, isAllowed);
  const columns = useLogColumns({
    ns: 'audit',
    showCompany: role === 'super_admin',
    showIp: true,
    onDetails: setSelectedLog,
  });

  if (!isAllowed) return <Alert tone="danger">{t('errors.forbidden', 'Kirish taqiqlangan')}</Alert>;

  const logs = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta ?? { page: 1, limit: 15, total: 0 };

  return (
    <>
      <PageHeader
        title={t('pages.auditLog', 'Audit jurnali')}
        description={t(
          'audit.description',
          "Tizimdagi barcha xavfsizlik va ma'lumotlar o'zgarishlari tarixi",
        )}
      />
      <LogFilterBar filters={filters} ns="audit" />
      <div>
        <DataTable
          caption={t('pages.auditLog', 'Audit jurnali')}
          columns={columns}
          rows={logs}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={
            <EmptyState icon="shield-check" title={t('audit.empty', 'Audit yozuvlari topilmadi')} />
          }
        />
        {meta.total > meta.limit && (
          <Pagination meta={meta} onPageChange={filters.setPage} showSummary />
        )}
      </div>
      <LogDetailsModal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />
    </>
  );
}
