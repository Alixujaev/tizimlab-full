import { type ComponentPropsWithRef, type ReactNode, useId } from 'react';
import { cx } from '../../lib/cx';

export interface RadioProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  label: ReactNode;
  description?: ReactNode;
}

/** Native radio ko'rinmas (strelkalar bilan guruh ichida harakat brauzerdan), ko'rinish — tokenlardan. */
export function Radio({ label, description, className, disabled, ...rest }: RadioProps) {
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
          type="radio"
          disabled={disabled}
          className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cx(
            'size-4.5 rounded-full border border-line-strong bg-surface shadow-sm transition-colors motion-fast',
            'peer-checked:border-primary',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
          )}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-2 scale-0 rounded-full bg-primary transition-transform motion-fast peer-checked:scale-100"
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-fg">{label}</span>
        {description && <span className="text-xs text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}

export interface RadioGroupProps<V extends string = string> {
  label: ReactNode;
  name: string;
  value: V | '' | null | undefined;
  onChange: (value: V) => void;
  options: ReadonlyArray<{
    value: V;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
  }>;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  className?: string;
}

export function RadioGroup<V extends string = string>({
  label,
  name,
  value,
  onChange,
  options,
  orientation = 'vertical',
  disabled,
  className,
}: RadioGroupProps<V>) {
  const labelId = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cx('flex flex-col gap-2', className)}
    >
      <span id={labelId} className="text-sm font-medium text-fg">
        {label}
      </span>
      <div
        className={cx('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-x-6')}
      >
        {options.map((o) => (
          <Radio
            key={o.value}
            name={name}
            value={o.value}
            label={o.label}
            description={o.description}
            checked={value === o.value}
            disabled={disabled || o.disabled}
            onChange={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}
