import { type ReactNode, useId } from 'react';
import { cx } from '../../lib/cx';

const sizes = {
  sm: { track: 'h-5 w-9', thumb: 'size-4', on: 'translate-x-4' },
  md: { track: 'h-6 w-11', thumb: 'size-5', on: 'translate-x-5' },
} as const;

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Ko'rinadigan yorliq; yo'q bo'lsa `aria-label` majburiy. */
  label?: ReactNode;
  description?: ReactNode;
  'aria-label'?: string;
  disabled?: boolean;
  size?: keyof typeof sizes;
  id?: string;
  className?: string;
}

/** Darhol kuchga kiradigan yoqish/o'chirish (`role="switch"`). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  'aria-label': ariaLabel,
  disabled,
  size = 'md',
  id,
  className,
}: SwitchProps) {
  const autoId = useId();
  const labelId = `${autoId}-label`;
  const descId = `${autoId}-desc`;
  const s = sizes[size];
  return (
    <div className={cx('inline-flex items-start gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors motion-fast focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-line-strong',
          s.track,
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'rounded-full bg-surface shadow-sm transition-transform motion-fast',
            s.thumb,
            checked ? s.on : 'translate-x-0',
          )}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col gap-0.5 text-sm">
          {label && (
            <span id={labelId} className="text-fg">
              {label}
            </span>
          )}
          {description && (
            <span id={descId} className="text-xs text-fg-muted">
              {description}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
