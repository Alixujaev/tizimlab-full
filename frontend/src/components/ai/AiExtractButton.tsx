import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { canUseAi } from '@/config/ai';
import { useAiEnabled, useExtractDocumentMutation } from '@/hooks/useAi';
import i18n from '@/i18n';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { AiDocumentKind, AiExtractionDto } from '@/types';
import { Alert, FileButton } from '@/ui';
import { isPoorQuality } from './useAiFill';

/** Rasm (kamera) yoki PDF — mobil brauzer tanlovida kamera ham taklif qilinadi. */
const AI_ACCEPT = ['image/*', 'application/pdf'] as const;

type Message = { tone: 'success' | 'info' | 'warning' | 'danger'; text: string };

/** AI xato kodi → tarjima (`ai.errors.<CODE>`), bo'lmasa umumiy xato matni. */
export function aiErrorText(err: unknown): string {
  const code = toApiError(err)?.code;
  const key = `ai.errors.${code ?? ''}`;
  return code && i18n.exists(key) ? i18n.t(key) : errorMessage(err);
}

/**
 * P18 (D-181): "Hujjatdan to'ldirish". AI o'chiq/sozlanmagan bo'lsa umuman ko'rinmaydi; xato/past sifatda
 * faqat xabar chiqadi — forma qo'lda to'ldirishga to'liq ochiq qoladi. `onExtracted` — to'ldirilgan maydonlar soni.
 */
export function AiExtractButton({
  kind,
  onExtracted,
}: {
  kind: AiDocumentKind;
  onExtracted: (x: AiExtractionDto) => number;
}) {
  const { t } = useTranslation();
  const role = useAuthStore((st) => st.user?.role);
  const enabled = useAiEnabled() && canUseAi(kind, role);
  const mutation = useExtractDocumentMutation(kind);
  const [message, setMessage] = useState<Message | null>(null);
  if (!enabled) return null;

  const run = (file: File) => {
    setMessage(null);
    mutation.mutate(file, {
      onSuccess: (x) => {
        if (isPoorQuality(x)) {
          setMessage({ tone: 'warning', text: t('ai.poorQuality') });
        } else if (x.status !== 'ok') {
          setMessage({ tone: 'warning', text: t('ai.failed') });
        } else {
          const count = onExtracted(x);
          setMessage(
            count > 0
              ? { tone: 'success', text: t('ai.filled', { count }) }
              : { tone: 'info', text: t('ai.nothingFilled') },
          );
        }
      },
      onError: (err) => setMessage({ tone: 'danger', text: aiErrorText(err) }),
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-primary-line bg-primary-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-primary-subtle-fg">{t('ai.hint')}</p>
        <FileButton
          accept={AI_ACCEPT}
          leftIcon="file-text"
          loading={mutation.isPending}
          onSelect={run}
        >
          {t('ai.fillFromDocument')}
        </FileButton>
      </div>
      {mutation.isPending && <p className="text-xs text-fg-muted">{t('ai.reading')}</p>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
