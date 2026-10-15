import { type ReactNode, useRef } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '../Button';
import type { IconName } from '../Icon';

export interface FileButtonProps {
  /** Tanlangan fayl (tanlov oynasi yopilgach). */
  onSelect: (file: File) => void;
  children: ReactNode;
  /** Ruxsat etilgan kengaytmalar yoki MIME turlari. */
  accept?: readonly string[];
  /** Mobil qurilmalarda kamera / mikrofon / sensor (masalan 'environment'). */
  capture?: 'user' | 'environment';
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Darhol yuklanadigan fayl amali ("Yuklash", "Almashtirish") — oddiy tugma ko'rinishida.
 * Forma ichida fayl tanlash uchun — FileDropzone.
 */
export function FileButton({
  onSelect,
  children,
  accept,
  capture,
  variant = 'secondary',
  size = 'sm',
  leftIcon = 'upload',
  loading,
  disabled,
  className,
}: FileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        leftIcon={leftIcon}
        loading={loading}
        disabled={disabled}
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        capture={capture}
        accept={accept?.map((e) => (e.startsWith('.') || e.includes('/') ? e : `.${e}`)).join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onSelect(file);
        }}
      />
    </>
  );
}
