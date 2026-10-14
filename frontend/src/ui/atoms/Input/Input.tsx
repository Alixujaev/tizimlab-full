import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { fieldClasses, fieldSizes, useFieldProps, type FieldSize } from '../../lib/field';
import { Icon, type IconName } from '../Icon';

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  size?: FieldSize;
  invalid?: boolean;
  leftIcon?: IconName;
  /** O'ng tomondagi qo'shimcha (birlik, tugma). */
  rightSlot?: ReactNode;
}

export function Input({
  size = 'md',
  invalid,
  leftIcon,
  rightSlot,
  className,
  type = 'text',
  id,
  required,
  disabled,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: InputProps) {
  const field = useFieldProps({
    id,
    invalid,
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
  });
  const { invalid: isInvalid, ...a11y } = field;
  const input = (
    <input
      type={type}
      {...a11y}
      className={cx(
        fieldClasses(isInvalid),
        fieldSizes[size],
        leftIcon && 'pl-9',
        rightSlot ? 'pr-10' : undefined,
        !leftIcon && !rightSlot && className,
      )}
      {...rest}
    />
  );
  if (!leftIcon && !rightSlot) return input;
  return (
    <div className={cx('relative', className)}>
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle">
          <Icon name={leftIcon} size="sm" />
        </span>
      )}
      {input}
      {rightSlot && (
        <span className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</span>
      )}
    </div>
  );
}
