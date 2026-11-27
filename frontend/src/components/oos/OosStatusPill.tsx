import { useTranslation } from 'react-i18next';
import type { OosStatus } from '@/types';
import { StatusPill, type Tone } from '@/ui';

/** OOS ish holati (jurnal holati — natija bo'yicha xulosa emas). */
const TONE: Record<OosStatus, Tone> = {
  open: 'danger',
  investigating: 'warning',
  closed: 'neutral',
};

export function OosStatusPill({ status }: { status: OosStatus }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={TONE[status] ?? 'neutral'}>{t(`oos.status.${status}`, status)}</StatusPill>
  );
}
