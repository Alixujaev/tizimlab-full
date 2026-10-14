import { createContext, useContext } from 'react';
import { cx } from './cx';

/** FormField → boshqaruv elementiga: id, tavsif/xato bog'lanishi, holatlar. */
export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

interface OwnFieldProps {
  id?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
}

/** Element o'z prop'lari ustun; yo'q bo'lsa — FormField kontekstidan. */
export function useFieldProps(own: OwnFieldProps) {
  const field = useField();
  const invalid = own.invalid ?? field?.invalid ?? false;
  const describedBy =
    [own['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined;
  return {
    id: own.id ?? field?.id,
    invalid,
    required: own.required ?? field?.required,
    disabled: own.disabled ?? field?.disabled,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  };
}

export const fieldSizes = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-9 px-3 text-sm',
  lg: 'h-11 px-3.5 text-base',
} as const;

export type FieldSize = keyof typeof fieldSizes;

/** Input, Textarea, Select, DatePicker, SearchInput uchun umumiy ko'rinish. */
export function fieldClasses(invalid: boolean): string {
  return cx(
    'w-full rounded-lg border bg-surface text-fg shadow-sm placeholder:text-fg-subtle transition-colors motion-fast',
    'focus:outline-none focus:ring-2',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-subtle',
    invalid
      ? 'border-danger focus:border-danger focus:ring-danger/25'
      : 'border-line-strong hover:border-fg-subtle focus:border-primary focus:ring-primary/25',
  );
}
