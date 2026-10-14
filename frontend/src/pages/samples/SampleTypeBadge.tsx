import { useTranslation } from 'react-i18next';
import type { SampleType } from '@/types';
import { Badge, type Tone } from '@/ui';

const TYPE_TONE: Record<SampleType, Tone> = {
  raw_material: 'info',
  finished_product: 'primary',
  reagent: 'success',
  standard_substance: 'accent',
  other: 'neutral',
};

interface SampleTypeBadgeProps {
  type: SampleType;
  className?: string;
}

export function SampleTypeBadge({ type, className }: SampleTypeBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge tone={TYPE_TONE[type] ?? 'neutral'} className={className}>
      {t(`samples.types.${type}`, type)}
    </Badge>
  );
}
