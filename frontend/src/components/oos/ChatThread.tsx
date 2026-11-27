import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CHAT_ACCEPT,
  CHAT_MAX_ATTACHMENTS_PER_MESSAGE,
  CHAT_MAX_ATTACHMENTS_PER_SESSION,
  CHAT_MAX_QUESTION,
} from '@/config/oos';
import { useAiEnabled } from '@/hooks/useAi';
import {
  useChatSessionQuery,
  useSendChatMessageMutation,
  useUploadChatAttachmentMutation,
} from '@/hooks/useOos';
import { formatDateTime } from '@/lib/date';
import type { ChatMessageDto, OosPeakFileRef } from '@/types';
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  FileButton,
  formatBytes,
  FormField,
  Input,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '@/ui';
import { ChatAnswer } from './ChatAnswer';
import { oosErrorText } from './format';

/** AI o'chiq/xato: jurnal to'liq ishlaydi, chat o'rnida aniq xabar. */
export function AiOffNotice() {
  const { t } = useTranslation();
  return (
    <Alert tone="info" title={t('oos.chat.aiOffTitle')}>
      {t('oos.chat.aiOff')}
    </Alert>
  );
}

function UserBubble({ m }: { m: ChatMessageDto }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-full rounded-lg bg-primary-subtle px-3 py-2 text-sm whitespace-pre-line break-words text-primary-subtle-fg sm:max-w-prose">
        {m.content}
      </div>
      <span className="text-xs text-fg-muted">{formatDateTime(m.createdAt)}</span>
    </div>
  );
}

const NO_PEAK = 'none';

/**
 * Bitta suhbat: xabarlar, ilovalar va savol formasi. `readOnly` (direktor) — forma yo'q.
 * Javob to'liq keladi (striming yo'q); xatoda savol matni saqlanadi va xato chat ichida ko'rsatiladi.
 */
export function ChatThread({
  sessionId,
  readOnly,
  peakFiles,
  substanceFilter = false,
}: {
  sessionId: string;
  readOnly: boolean;
  /** OOS ishiga bog'langan peak fayllari (tanlash uchun) */
  peakFiles?: OosPeakFileRef[];
  /** Erkin suhbatda modda nomi bo'yicha qidiruv filtri */
  substanceFilter?: boolean;
}) {
  const { t } = useTranslation();
  const aiEnabled = useAiEnabled();
  const { data: session, isLoading, isError, refetch } = useChatSessionQuery(sessionId);
  const send = useSendChatMessageMutation(sessionId);
  const upload = useUploadChatAttachmentMutation(sessionId);
  const [question, setQuestion] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [peakFileId, setPeakFileId] = useState(NO_PEAK);
  const [substance, setSubstance] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton variant="rect" className="h-16 w-full" />
        <Skeleton variant="rect" className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !session) return <ErrorState onRetry={() => void refetch()} />;

  const attachments = session.attachments;
  const trimmed = question.trim();
  const tooLong = question.length > CHAT_MAX_QUESTION;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || tooLong || send.isPending) return;
    setSendError(null);
    setPending(trimmed);
    send.mutate(
      {
        content: trimmed,
        ...(selected.length ? { attachmentIds: selected } : {}),
        ...(peakFileId !== NO_PEAK ? { peakFileId } : {}),
        ...(substanceFilter && substance.trim()
          ? { filters: { substanceName: substance.trim() } }
          : {}),
      },
      {
        onSuccess: () => {
          setQuestion('');
          setSelected([]);
        },
        // Savol matni o'chirilmaydi — foydalanuvchi qayta yuborishi mumkin
        onError: (err) => setSendError(oosErrorText(err)),
        onSettled: () => setPending(null),
      },
    );
  };

  const toggleAttachment = (id: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  return (
    <div className="flex flex-col gap-4">
      {session.messages.length === 0 && !pending ? (
        <p className="text-sm text-fg-muted">{t('oos.chat.emptyThread')}</p>
      ) : (
        <ol className="flex flex-col gap-4" aria-label={t('oos.chat.messages')}>
          {session.messages.map((m) => (
            <li key={m.id}>
              {m.role === 'user' ? <UserBubble m={m} /> : <ChatAnswer message={m} />}
            </li>
          ))}
          {pending && (
            <li className="flex flex-col gap-2">
              <div className="self-end rounded-lg bg-primary-subtle px-3 py-2 text-sm whitespace-pre-line text-primary-subtle-fg">
                {pending}
              </div>
              <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
                <Spinner size="sm" inline />
                {t('oos.chat.thinking')}
              </p>
            </li>
          )}
        </ol>
      )}

      {sendError && (
        <Alert tone="danger" title={t('oos.chat.sendFailed')}>
          {sendError}
        </Alert>
      )}

      {readOnly ? (
        <p className="text-xs text-fg-muted">{t('oos.chat.readOnly')}</p>
      ) : !aiEnabled ? (
        <AiOffNotice />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-3">
          <FormField
            label={t('oos.chat.question')}
            hint={t('oos.chat.questionHint', { max: CHAT_MAX_QUESTION })}
            error={tooLong ? t('oos.chat.tooLong', { max: CHAT_MAX_QUESTION }) : undefined}
          >
            <Textarea
              rows={3}
              value={question}
              invalid={tooLong}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </FormField>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {peakFiles && peakFiles.length > 0 && (
              <FormField label={t('oos.chat.peakFile')} className="w-full sm:w-64">
                <Select
                  value={peakFileId}
                  onChange={setPeakFileId}
                  options={[
                    { value: NO_PEAK, label: t('oos.chat.noPeakFile') },
                    ...peakFiles.map((f) => ({
                      value: f.id,
                      label: `${f.fileName} (${t('oos.peakFiles.confirmed', { count: f.confirmedResults })})`,
                    })),
                  ]}
                />
              </FormField>
            )}
            {substanceFilter && (
              <FormField label={t('oos.chat.substanceFilter')} className="w-full sm:w-64">
                <Input value={substance} onChange={(e) => setSubstance(e.target.value)} />
              </FormField>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-fg-muted">
                {t('oos.chat.attachmentsHint', {
                  max: CHAT_MAX_ATTACHMENTS_PER_MESSAGE,
                  total: CHAT_MAX_ATTACHMENTS_PER_SESSION,
                })}
              </span>
              {attachments.length < CHAT_MAX_ATTACHMENTS_PER_SESSION && (
                <FileButton
                  accept={CHAT_ACCEPT}
                  leftIcon="upload"
                  loading={upload.isPending}
                  onSelect={(file) => {
                    setUploadError(null);
                    upload.mutate(file, {
                      onSuccess: (att) =>
                        setSelected((prev) =>
                          prev.length < CHAT_MAX_ATTACHMENTS_PER_MESSAGE ? [...prev, att.id] : prev,
                        ),
                      onError: (err) => setUploadError(oosErrorText(err)),
                    });
                  }}
                >
                  {t('oos.chat.attach')}
                </FileButton>
              )}
            </div>
            {uploadError && <Alert tone="danger">{uploadError}</Alert>}
            {attachments.length > 0 && (
              <div className="flex flex-col gap-1">
                {attachments.map((a) => {
                  const checked = selected.includes(a.id);
                  return (
                    <Checkbox
                      key={a.id}
                      label={a.fileName}
                      description={formatBytes(a.size)}
                      checked={checked}
                      disabled={!checked && selected.length >= CHAT_MAX_ATTACHMENTS_PER_MESSAGE}
                      onChange={(e) => toggleAttachment(a.id, e.target.checked)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              leftIcon="send"
              loading={send.isPending}
              disabled={!trimmed || tooLong}
              className="w-full sm:w-auto"
            >
              {t('oos.chat.send')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
