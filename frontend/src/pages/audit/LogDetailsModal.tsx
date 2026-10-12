import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import type { AuditLogDto } from '@/types';

interface LogDetailsModalProps {
  open: boolean;
  onClose: () => void;
  log: AuditLogDto | null;
}

export function LogDetailsModal({ open, onClose, log }: LogDetailsModalProps) {
  const { t } = useTranslation();

  if (!log) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{t('audit.details.title')}</span>
          <span className="font-mono text-xs text-slate-400">#{log.id.slice(0, 8)}</span>
        </div>
      }
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-xs">
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.action')}: </span>
            <span className="font-semibold text-slate-900">{log.action}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.table')}: </span>
            <span className="font-mono font-medium text-slate-900">{log.tableName}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.recordId')}: </span>
            <span className="font-mono text-slate-900">{log.recordId ?? '-'}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.createdAt')}: </span>
            <span>{new Date(log.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.user')}: </span>
            <span>{log.userFullName ?? log.userEmail ?? log.userId ?? '-'}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.company')}: </span>
            <span>{log.companyName ?? log.companyId ?? '-'}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.ip')}: </span>
            <span className="font-mono">{log.ipAddress ?? '-'}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">{t('audit.details.userAgent')}: </span>
            <span className="truncate" title={log.userAgent ?? ''}>
              {log.userAgent ?? '-'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="mb-1 text-xs font-semibold text-slate-600">
              {t('audit.details.oldValues')}
            </h4>
            <div className="max-h-60 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs font-mono text-amber-300">
              {log.oldValues ? (
                <pre>{JSON.stringify(log.oldValues, null, 2)}</pre>
              ) : (
                <span className="text-slate-500 italic">{t('common.none')}</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold text-slate-600">
              {t('audit.details.newValues')}
            </h4>
            <div className="max-h-60 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs font-mono text-emerald-300">
              {log.newValues ? (
                <pre>{JSON.stringify(log.newValues, null, 2)}</pre>
              ) : (
                <span className="text-slate-500 italic">{t('common.none')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
