import type { ReactNode } from 'react';
import { Icon } from '../../atoms/Icon';
import { Tooltip } from '../../atoms/Tooltip';

export interface MetricInfoProps {
  /** Tugma nomi (ekran o'quvchilar uchun), masalan: "Rad etish foizi formulasi". */
  label: string;
  /** Formula izohi. */
  children: ReactNode;
}

/** Ko'rsatkich yonidagi (i): formula izohi tooltip'da (sichqoncha va klaviatura fokusi bilan). */
export function MetricInfo({ label, children }: MetricInfoProps) {
  return (
    <Tooltip content={<span className="block max-w-64">{children}</span>} delay={150}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full text-fg-subtle focus-ring hover:text-fg"
      >
        <Icon name="info" size="xs" />
      </button>
    </Tooltip>
  );
}
