import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { fieldClasses, fieldSizes, useFieldProps, type FieldSize } from '../../lib/field';
import { useDismiss } from '../../lib/useDismiss';
import { usePopoverPosition } from '../../lib/usePopoverPosition';
import { Icon } from '../Icon';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<V extends string = string> {
  options: ReadonlyArray<SelectOption<V>>;
  value: V | '' | null | undefined;
  onChange: (value: V) => void;
  placeholder?: string;
  /** Forma yuborilishi uchun yashirin qiymat. */
  name?: string;
  id?: string;
  size?: FieldSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

const TYPEAHEAD_RESET_MS = 500;

/**
 * Maxsus select (WAI-ARIA "select-only combobox"): fokus tugmada qoladi, faol variant
 * `aria-activedescendant` bilan. ↑↓ Home End — harakat, Enter/Space/Tab — tanlash, Esc — yopish,
 * harf terish — mos variantga o'tish.
 */
export function Select<V extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  name,
  id,
  size = 'md',
  invalid,
  disabled,
  required,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: SelectProps<V>) {
  const { t } = useTranslation();
  const autoId = useId();
  const field = useFieldProps({
    id,
    invalid,
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
  });
  const triggerId = field.id ?? `${autoId}-trigger`;
  const listId = `${autoId}-list`;
  const optionId = (i: number) => `${autoId}-opt-${i}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typeahead = useRef({ text: '', at: 0 });

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const position = usePopoverPosition(triggerRef, listRef, open, { matchWidth: true });

  const enabledIndexes = useMemo(
    () => options.flatMap((o, i) => (o.disabled ? [] : [i])),
    [options],
  );

  const openList = useCallback(
    (start?: number) => {
      if (disabled || field.disabled) return;
      setActive(start ?? (selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? -1)));
      setOpen(true);
    },
    [disabled, field.disabled, selectedIndex, enabledIndexes],
  );

  const close = useCallback(() => setOpen(false), []);
  useDismiss([triggerRef, listRef], open, close);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    setOpen(false);
  };

  const move = (delta: number) => {
    if (!enabledIndexes.length) return;
    const pos = enabledIndexes.indexOf(active);
    const next =
      pos === -1
        ? delta > 0
          ? 0
          : enabledIndexes.length - 1
        : Math.min(enabledIndexes.length - 1, Math.max(0, pos + delta));
    setActive(enabledIndexes[next]!);
  };

  const matchTypeahead = (key: string) => {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? key : state.text + key;
    state.at = now;
    const needle = state.text.toLocaleLowerCase();
    const from = active >= 0 ? active : 0;
    const ordered = [
      ...enabledIndexes.filter((i) => i > from),
      ...enabledIndexes.filter((i) => i <= from),
    ];
    // Bir xil harf qayta bosilsa — keyingi mos variant
    const candidates = state.text.length === 1 ? ordered : enabledIndexes;
    return candidates.find((i) => options[i]!.label.toLocaleLowerCase().startsWith(needle));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList(e.key === 'ArrowUp' && selectedIndex < 0 ? enabledIndexes.at(-1) : undefined);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const hit = matchTypeahead(e.key);
        if (hit !== undefined) openList(hit);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActive(enabledIndexes[0] ?? -1);
        break;
      case 'End':
        e.preventDefault();
        setActive(enabledIndexes.at(-1) ?? -1);
        break;
      case 'Enter':
        e.preventDefault();
        choose(active);
        break;
      case ' ':
        e.preventDefault();
        if (typeahead.current.text && Date.now() - typeahead.current.at < TYPEAHEAD_RESET_MS) {
          const hit = matchTypeahead(' ');
          if (hit !== undefined) setActive(hit);
        } else {
          choose(active);
        }
        break;
      case 'Escape':
        // Modal ham Esc ni tinglaydi — faqat ro'yxat yopilsin
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case 'Tab':
        choose(active);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const hit = matchTypeahead(e.key);
          if (hit !== undefined) setActive(hit);
        }
    }
  };

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // optionId — barqaror (useId asosida)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const isDisabled = disabled ?? field.disabled;

  return (
    <div className={cx('relative', className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
        aria-required={field.required || undefined}
        disabled={isDisabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          fieldClasses(field.invalid),
          fieldSizes[size],
          'flex items-center justify-between gap-2 pr-2 text-left',
        )}
      >
        <span className={cx('truncate', !selected && 'text-fg-subtle')}>
          {selected?.label ?? placeholder ?? t('ui.select')}
        </span>
        <Icon name="chevrons-up-down" size="sm" className="text-fg-subtle" />
      </button>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={ariaLabelledBy ?? triggerId}
            tabIndex={-1}
            style={position}
            className="z-popover max-h-popover min-w-popover animate-scale-in overflow-auto rounded-lg border border-line bg-surface p-1 text-sm shadow-lg"
          >
            {options.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-fg-subtle">
                {t('ui.noOptions')}
              </li>
            )}
            {options.map((o, i) => {
              const isSelected = i === selectedIndex;
              return (
                <li
                  key={`${o.value}-${i}`}
                  id={optionId(i)}
                  role="option"
                  data-value={o.value}
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={cx(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-fg',
                    i === active && 'bg-surface-sunken',
                    isSelected && 'font-medium text-primary-subtle-fg',
                    o.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && <Icon name="check" size="sm" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
