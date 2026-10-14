import { type ReactNode, useId, useMemo } from 'react';
import { Icon } from '../../atoms/Icon';
import { cx } from '../../lib/cx';
import { FieldContext, type FieldContextValue } from '../../lib/field';

export interface FormFieldProps {
  label: ReactNode;
  /** Bitta boshqaruv elementi (Input, Select, DatePicker ...) — id va aria avtomatik ulanadi. */
  children: ReactNode;
  hint?: ReactNode;
  /** Inline xato matni — element `aria-invalid`, matn `aria-describedby` orqali o'qiladi. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Yorliq yonidagi qo'shimcha (masalan, "Parolni unutdingizmi?"). */
  labelAside?: ReactNode;
  className?: string;
}

export function FormField({
  label,
  children,
  hint,
  error,
  required = false,
  disabled = false,
  id,
  labelAside,
  className,
}: FormFieldProps) {
  const autoId = useId();
  const controlId = id ?? `${autoId}-control`;
  const hintId = hint ? `${autoId}-hint` : undefined;
  const errorId = error ? `${autoId}-error` : undefined;
  const value = useMemo<FieldContextValue>(
    () => ({
      id: controlId,
      describedBy: [hintId, errorId].filter(Boolean).join(' ') || undefined,
      invalid: !!error,
      required,
      disabled,
    }),
    [controlId, hintId, errorId, error, required, disabled],
  );

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={controlId} className="text-sm font-medium text-fg">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger-fg">
              *
            </span>
          )}
        </label>
        {labelAside}
      </div>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs text-danger-fg">
          <Icon name="alert-circle" size="xs" className="mt-px" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
