import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityLogsQuery } from '@/hooks/useAudit';
import { useAuthStore } from '@/store/authStore';
import type { AuditLogDto } from '@/types';
import { Alert, DataTable, EmptyState, PageHeader, Pagination } from '@/ui';
import { LogDetailsModal } from '../audit/LogDetailsModal';
import { LogFilterBar, useLogColumns, useLogFilters } from '../audit/logsShared';

export function ActivityPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  // activity:view — lab_head, director, admin (D-147, spec §1)
  const isAllowed = role === 'lab_head' || role === 'director' || role === 'admin';
  const filters = useLogFilters();
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);
  // Ruxsatsiz rol uchun so'rov yuborilmaydi (403 qoidasi)
  const { data, isLoading, isError, refetch } = useActivityLogsQuery(filters.params, isAllowed);
  const columns = useLogColumns({
    ns: 'activity',
    showCompany: false,
    showIp: false,
    onDetails: setSelectedLog,
  });

  if (!isAllowed) return <Alert tone="danger">{t('errors.forbidden', 'Kirish taqiqlangan')}</Alert>;

  const logs = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta ?? { page: 1, limit: 15, total: 0 };

  return (
    <>
      <PageHeader
        title={t('pages.activity', 'Faoliyat jurnali')}
        description={t(
          'activity.description',
          "Laboratoriya xodimlarining faoliyati va ma'lumotlar tarixi",
        )}
      />
      <LogFilterBar filters={filters} ns="activity" />
      <div>
        <DataTable
          caption={t('pages.activity', 'Faoliyat jurnali')}
          columns={columns}
          rows={logs}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={
            <EmptyState
              icon="activity"
              title={t('activity.empty', 'Faoliyat yozuvlari topilmadi')}
            />
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
