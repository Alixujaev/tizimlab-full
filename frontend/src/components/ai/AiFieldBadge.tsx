import { useTranslation } from 'react-i18next';
import { Badge } from '@/ui';
import type { AiFieldMark } from './useAiFill';

const needsCheck = (mark: AiFieldMark | undefined) =>
  mark?.confidence === 'low' || mark?.confidence === 'medium';

/** AI to'ldirgan maydon belgisi (FormField `labelAside`); past/o'rta ishonch — "Tekshiring". */
export function AiFieldBadge({ mark }: { mark: AiFieldMark | undefined }) {
  const { t } = useTranslation();
  if (!mark) return null;
  return (
    <span className="flex items-center gap-1">
      <Badge size="sm" tone="primary">
        {t('ai.badge')}
      </Badge>
      {needsCheck(mark) && (
        <Badge size="sm" tone="warning" icon="alert-triangle">
          {t('ai.check')}
        </Badge>
      )}
    </span>
  );
}

/** FormField uchun: belgi va (past/o'rta ishonchda) ogohlantiruvchi fon. */
export function aiFieldProps(mark: AiFieldMark | undefined) {
  return {
    labelAside: mark ? <AiFieldBadge mark={mark} /> : undefined,
    className: needsCheck(mark)
      ? 'rounded-lg border border-warning-line bg-warning-subtle p-2'
      : undefined,
  };
}
