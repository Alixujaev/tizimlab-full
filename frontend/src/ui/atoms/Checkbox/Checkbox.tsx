import { type ComponentPropsWithRef, type ReactNode, type Ref, useCallback } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon';

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
  /** "Qisman tanlangan" holati (masalan, guruhdagi ba'zi elementlar). */
  indeterminate?: boolean;
  invalid?: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/** Native checkbox ko'rinmas (lekin fokus/klaviatura/forma uchun ishlaydi), ko'rinish — tokenlardan. */
export function Checkbox({
  label,
  description,
  indeterminate = false,
  invalid = false,
  className,
  disabled,
  ref,
  ...rest
}: CheckboxProps) {
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = indeterminate;
      assignRef(ref, el);
    },
    [indeterminate, ref],
  );
  return (
    <label
      className={cx(
        'inline-flex items-start gap-2.5 text-sm',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-0.5 flex size-4.5 shrink-0 items-center justify-center">
        <input
          ref={setRef}
          type="checkbox"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cx(
            'size-4.5 rounded-sm border bg-surface shadow-sm transition-colors motion-fast',
            'peer-checked:border-primary peer-checked:bg-primary',
            'peer-indeterminate:border-primary peer-indeterminate:bg-primary',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            invalid ? 'border-danger' : 'border-line-strong',
          )}
        />
        <Icon
          name="check"
          size="xs"
          className="pointer-events-none absolute text-primary-fg opacity-0 transition-opacity motion-fast peer-checked:opacity-100 peer-indeterminate:opacity-0"
        />
        <Icon
          name="minus"
          size="xs"
          className="pointer-events-none absolute text-primary-fg opacity-0 peer-indeterminate:opacity-100"
        />
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5">
          {label && <span className="text-fg">{label}</span>}
          {description && <span className="text-xs text-fg-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
