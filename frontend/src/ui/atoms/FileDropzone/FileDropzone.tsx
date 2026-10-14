import { type DragEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALLOWED_EXTENSIONS, PASSPORT_MAX_BYTES } from '@/lib/files';
import { cx } from '../../lib/cx';
import { useFieldProps } from '../../lib/field';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';

export type FileRejectReason = 'badType' | 'tooLarge' | 'empty';

export interface FileDropzoneProps {
  value: File | null;
  onChange: (file: File | null) => void;
  /** Ruxsat etilgan kengaytmalar (nuqtasiz). Standart — `lib/files.ts` ro'yxati. */
  accept?: readonly string[];
  maxBytes?: number;
  /** Tashqi xato (masalan, server javobi) — ko'rinadi va `aria-invalid`. */
  error?: string;
  onReject?: (reason: FileRejectReason, file: File) => void;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Fayl tanlash: sudrab tashlash yoki klaviatura/bosish bilan (ichidagi native input ko'rinmas). */
export function FileDropzone({
  value,
  onChange,
  accept = ALLOWED_EXTENSIONS,
  maxBytes = PASSPORT_MAX_BYTES,
  error,
  onReject,
  id,
  disabled,
  required,
  className,
  'aria-describedby': ariaDescribedBy,
}: FileDropzoneProps) {
  const { t } = useTranslation();
  const autoId = useId();
  const hintId = `${autoId}-hint`;
  const errorId = `${autoId}-error`;
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const field = useFieldProps({ id, required, disabled, invalid: !!(error || localError) });
  const inputId = field.id ?? `${autoId}-input`;
  const maxMb = Math.round(maxBytes / 1024 / 1024);
  const message = error ?? localError;

  const take = (file: File | undefined) => {
    if (!file) return;
    const reason: FileRejectReason | null = !accept.includes(extOf(file.name))
      ? 'badType'
      : file.size === 0
        ? 'empty'
        : file.size > maxBytes
          ? 'tooLarge'
          : null;
    if (reason) {
      setLocalError(
        reason === 'tooLarge' ? t('ui.file.tooLarge', { max: maxMb }) : t('ui.file.badType'),
      );
      onReject?.(reason, file);
      return;
    }
    setLocalError(null);
    onChange(file);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!field.disabled) take(e.dataTransfer.files[0]);
  };

  const describedBy = [ariaDescribedBy, field['aria-describedby'], hintId, message ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted px-3 py-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-fg">
            <Icon name="file-text" size="sm" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{value.name}</span>
            <span className="block text-xs text-fg-muted">{formatBytes(value.size)}</span>
          </span>
          <IconButton
            icon="x"
            label={t('ui.file.remove')}
            size="sm"
            disabled={field.disabled}
            onClick={() => onChange(null)}
          />
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            if (!field.disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors motion-fast',
            'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25',
            field.disabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:border-primary',
            dragging ? 'border-primary bg-primary-subtle' : 'bg-surface-muted',
            message ? 'border-danger' : !dragging && 'border-line-strong',
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-fg-muted shadow-sm">
            <Icon name="upload" size="md" />
          </span>
          <span className="text-sm text-fg">
            {t('ui.file.drop')}{' '}
            <span className="font-medium text-primary-subtle-fg underline underline-offset-2">
              {t('ui.file.browse')}
            </span>
          </span>
          <span id={hintId} className="text-xs text-fg-muted">
            {t('ui.file.hint', { types: accept.join(', ').toUpperCase(), max: maxMb })}
          </span>
          <input
            id={inputId}
            type="file"
            className="sr-only"
            accept={accept.map((e) => `.${e}`).join(',')}
            disabled={field.disabled}
            required={field.required}
            aria-invalid={field['aria-invalid']}
            aria-describedby={describedBy || undefined}
            onChange={(e) => {
              take(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}
      {message && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs text-danger-fg">
          <Icon name="alert-circle" size="xs" />
          {message}
        </p>
      )}
    </div>
  );
}
