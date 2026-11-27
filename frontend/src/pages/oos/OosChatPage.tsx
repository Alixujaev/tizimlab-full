import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ChatThread } from '@/components/oos/ChatThread';
import { canWriteOos } from '@/config/oos';
import { useChatSessionQuery } from '@/hooks/useOos';
import { formatDateTime } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import { ButtonLink, Card, PageHeader } from '@/ui';

/** P19: erkin AI suhbat (OOS ishiga bog'lanmagan) — ichki baza bo'yicha savol-javob. */
export function OosChatPage() {
  const { t } = useTranslation();
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const { data: session } = useChatSessionQuery(sessionId);

  return (
    <>
      <PageHeader
        title={
          session?.title ??
          (session
            ? t('oos.chat.sessionFrom', { date: formatDateTime(session.createdAt) })
            : t('oos.chat.title'))
        }
        description={t('oos.chat.freeSessionsHint')}
        back={{ to: '/oos', label: t('oos.title') }}
        actions={
          session?.caseId ? (
            <ButtonLink to={`/oos/${session.caseId}`} variant="secondary" leftIcon="clipboard">
              {t('oos.chat.openCase')}
            </ButtonLink>
          ) : undefined
        }
      />
      <Card>
        <ChatThread sessionId={sessionId} readOnly={!canWriteOos(role)} substanceFilter />
      </Card>
    </>
  );
}
