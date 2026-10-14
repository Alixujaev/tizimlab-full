import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';
import { fieldClasses, useFieldProps } from '../../lib/field';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
}

export function Textarea({
  invalid,
  className,
  rows = 3,
  id,
  required,
  disabled,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: TextareaProps) {
  const { invalid: isInvalid, ...a11y } = useFieldProps({
    id,
    invalid,
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
  });
  return (
    <textarea
      rows={rows}
      {...a11y}
      className={cx(fieldClasses(isInvalid), 'min-h-20 resize-y px-3 py-2 text-sm', className)}
      {...rest}
    />
  );
}
