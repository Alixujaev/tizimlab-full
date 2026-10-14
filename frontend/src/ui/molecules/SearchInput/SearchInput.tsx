import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../atoms/IconButton';
import { Input } from '../../atoms/Input';
import type { FieldSize } from '../../lib/field';

export interface SearchInputProps {
  value: string;
  /** Yozish to'xtagach (`debounceMs`) chaqiriladi — har harfga so'rov ketmaydi. */
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  'aria-label'?: string;
  size?: FieldSize;
  className?: string;
  id?: string;
}

export function SearchInput({
  value,
  onChange,
  debounceMs = 300,
  placeholder,
  'aria-label': ariaLabel,
  size = 'md',
  className,
  id,
}: SearchInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Tashqi qiymat (masalan, filtrlar tozalandi) — sinxronlash
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChangeRef.current(text), debounceMs);
    return () => clearTimeout(timer);
  }, [text, value, debounceMs]);

  const clear = () => {
    setText('');
    onChangeRef.current('');
  };

  return (
    <Input
      id={id}
      type="search"
      size={size}
      leftIcon="search"
      value={text}
      placeholder={placeholder ?? t('common.search')}
      aria-label={ariaLabel ?? placeholder ?? t('common.search')}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && text) {
          // Modal ichida bo'lsa ham avval qidiruv tozalanadi
          e.preventDefault();
          e.stopPropagation();
          clear();
        }
      }}
      className={className}
      rightSlot={
        text ? <IconButton icon="x" label={t('ui.clear')} size="sm" onClick={clear} /> : undefined
      }
    />
  );
}
