import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiEnabled } from '@/hooks/useAi';
import { useChatSessionsQuery, useCreateChatSessionMutation } from '@/hooks/useOos';
import { formatDateTime } from '@/lib/date';
import type { OosPeakFileRef } from '@/types';
import { Button, Card, EmptyState, ErrorState, FormField, Select, Skeleton } from '@/ui';
import { AiOffNotice, ChatThread } from './ChatThread';

/** OOS ishi bo'yicha AI kopilot: shu ishning suhbatlari, yangi suhbat va savol-javob. */
export function CaseChatPanel({
  caseId,
  peakFiles,
  canWrite,
}: {
  caseId: string;
  peakFiles: OosPeakFileRef[];
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const aiEnabled = useAiEnabled();
  const { data: sessions, isLoading, isError, refetch } = useChatSessionsQuery(caseId);
  const create = useCreateChatSessionMutation();
  const [chosen, setChosen] = useState<string | null>(null);

  const list = sessions ?? [];
  const activeId = chosen && list.some((s) => s.id === chosen) ? chosen : (list[0]?.id ?? null);
  const label = (title: string | null, createdAt: string) =>
    title ?? t('oos.chat.sessionFrom', { date: formatDateTime(createdAt) });

  const startNew = () => create.mutate({ caseId }, { onSuccess: (s) => setChosen(s.id) });

  const newButton = canWrite && aiEnabled && (
    <Button
      variant="secondary"
      size="sm"
      leftIcon="plus"
      loading={create.isPending}
      onClick={startNew}
    >
      {t('oos.chat.newSession')}
    </Button>
  );

  return (
    <Card
      title={t('oos.chat.title')}
      description={t('oos.chat.description')}
      actions={list.length > 0 ? newButton : undefined}
    >
      {isLoading ? (
        <div role="status">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton variant="rect" className="h-24 w-full" />
        </div>
      ) : isError ? (
        <ErrorState size="sm" onRetry={() => void refetch()} />
      ) : list.length === 0 ? (
        canWrite && !aiEnabled ? (
          <AiOffNotice />
        ) : (
          <EmptyState
            size="sm"
            icon="info"
            title={t('oos.chat.noSessions')}
            action={newButton || undefined}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {list.length > 1 && (
            <FormField label={t('oos.chat.session')} className="w-full sm:w-80">
              <Select
                value={activeId ?? ''}
                onChange={setChosen}
                options={list.map((s) => ({ value: s.id, label: label(s.title, s.createdAt) }))}
              />
            </FormField>
          )}
          {activeId && (
            <ChatThread
              key={activeId}
              sessionId={activeId}
              readOnly={!canWrite}
              peakFiles={peakFiles}
            />
          )}
        </div>
      )}
    </Card>
  );
}
