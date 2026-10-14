import { useTranslation } from 'react-i18next';
import type { AuditLogDto } from '@/types';
import { Button, DescriptionList, Modal } from '@/ui';
import { ActionBadge } from './logsShared';

interface LogDetailsModalProps {
  open: boolean;
  onClose: () => void;
  log: AuditLogDto | null;
}

function JsonBlock({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-fg-muted">{title}</h3>
      <div className="max-h-60 overflow-auto rounded-lg border border-line bg-surface-sunken p-3 font-mono text-xs text-fg">
        {value ? (
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
        ) : (
          <span className="text-fg-subtle">{empty}</span>
        )}
      </div>
    </section>
  );
}

export function LogDetailsModal({ open, onClose, log }: LogDetailsModalProps) {
  const { t } = useTranslation();
  if (!log) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <span>{t('audit.details.title')}</span>
          <span className="font-mono text-xs font-normal text-fg-subtle">
            #{log.id.slice(0, 8)}
          </span>
        </span>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <DescriptionList
          className="rounded-lg border border-line bg-surface-muted p-4"
          items={[
            { label: t('audit.details.action'), value: <ActionBadge action={log.action} /> },
            { label: t('audit.details.table'), value: log.tableName, mono: true },
            { label: t('audit.details.recordId'), value: log.recordId, mono: true },
            {
              label: t('audit.details.createdAt'),
              value: new Date(log.createdAt).toLocaleString(),
            },
            {
              label: t('audit.details.user'),
              value: log.userFullName ?? log.userEmail ?? log.userId,
            },
            { label: t('audit.details.company'), value: log.companyName ?? log.companyId },
            { label: t('audit.details.ip'), value: log.ipAddress, mono: true },
            { label: t('audit.details.userAgent'), value: log.userAgent, wide: true },
          ]}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <JsonBlock
            title={t('audit.details.oldValues')}
            value={log.oldValues}
            empty={t('common.none')}
          />
          <JsonBlock
            title={t('audit.details.newValues')}
            value={log.newValues}
            empty={t('common.none')}
          />
        </div>
      </div>
    </Modal>
  );
}
