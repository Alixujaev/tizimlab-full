import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, parseDisplayDate } from '@/lib/date';
import { cx } from '../../lib/cx';
import { fieldClasses, fieldSizes, useFieldProps, type FieldSize } from '../../lib/field';
import { useDismiss } from '../../lib/useDismiss';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { usePopoverPosition } from '../../lib/usePopoverPosition';
import { Icon } from '../Icon';
import {
  addDays,
  addMonths,
  fromIso,
  inRange,
  monthGrid,
  sameDay,
  toIso,
  todayYmd,
  weekdayMon,
  type Ymd,
} from './calendar';

export interface DatePickerProps {
  /** ISO `YYYY-MM-DD` yoki bo'sh qator (D-157). */
  value: string | null | undefined;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  size?: FieldSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/** Yozilgan matnni ISO ga o'giradi: DD.MM.YYYY, DD/MM/YYYY, DDMMYYYY yoki YYYY-MM-DD. */
function parseTyped(text: string): string | null {
  const trimmed = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
    return fromIso(trimmed) ? parseDisplayDate(formatDate(trimmed)) : null;
  const digits = /^(\d{2})\D?(\d{2})\D?(\d{4})$/.exec(trimmed);
  return digits ? parseDisplayDate(`${digits[1]}.${digits[2]}.${digits[3]}`) : null;
}

/**
 * Sana tanlash: DD.MM.YYYY ko'rinishida yoziladi yoki kalendar dialogidan tanlanadi.
 * Kalendar: ←→ kun, ↑↓ hafta, PageUp/PageDown oy (Shift — yil), Home/End hafta boshi/oxiri,
 * Enter/Space tanlash, Esc yopish.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  name,
  id,
  size = 'md',
  invalid,
  disabled,
  required,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const field = useFieldProps({
    id,
    invalid,
    required,
    disabled,
    'aria-describedby': ariaDescribedBy,
  });
  const autoId = useId();
  const inputId = field.id ?? `${autoId}-input`;
  const [text, setText] = useState(value ? formatDate(value) : '');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setText(value ? formatDate(value) : '');
  }, [value]);

  const commit = () => {
    if (!text.trim()) {
      if (value) onChange('');
      return;
    }
    const iso = parseTyped(text);
    if (iso && inRange(iso, min, max)) {
      if (iso !== value) onChange(iso);
      setText(formatDate(iso));
    } else {
      // Noto'g'ri sana qabul qilinmaydi — oxirgi to'g'ri qiymat tiklanadi
      setText(value ? formatDate(value) : '');
    }
  };

  const isDisabled = disabled ?? field.disabled;

  return (
    <div ref={anchorRef} className={cx('relative', className)}>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
        required={field.required}
        disabled={isDisabled}
        placeholder={placeholder ?? t('ui.date.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(fieldClasses(field.invalid), fieldSizes[size], 'pr-10 tabular-nums')}
      />
      <button
        ref={toggleRef}
        type="button"
        aria-label={t('ui.date.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={isDisabled}
        onClick={() => setOpen((o) => !o)}
        className="absolute inset-y-0 right-1 my-auto flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors motion-fast focus-ring hover:bg-surface-sunken hover:text-fg disabled:cursor-not-allowed"
      >
        <Icon name="calendar" size="sm" />
      </button>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {open && (
        <CalendarPopover
          anchorRef={anchorRef}
          toggleRef={toggleRef}
          value={value ?? ''}
          min={min}
          max={max}
          locale={i18n.language}
          onSelect={(iso) => {
            onChange(iso);
            setText(formatDate(iso));
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

interface CalendarPopoverProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  value: string;
  min?: string;
  max?: string;
  locale: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

function CalendarPopover({
  anchorRef,
  toggleRef,
  value,
  min,
  max,
  locale,
  onSelect,
  onClose,
}: CalendarPopoverProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const popRef = useRef<HTMLDivElement>(null);
  const focusDayRef = useRef<HTMLButtonElement>(null);
  const selected = fromIso(value);
  const [focused, setFocused] = useState<Ymd>(selected ?? todayYmd());
  const style = usePopoverPosition(anchorRef, popRef, true, { placement: 'bottom-start' });

  useFocusTrap(popRef, { active: true, onEscape: onClose, initialFocus: focusDayRef });
  useDismiss([popRef, toggleRef], true, onClose);

  // Klaviatura bilan kun o'zgarganda fokus yangi kunga o'tadi
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) focusDayRef.current?.focus();
  }, [focused]);

  const weeks = useMemo(() => monthGrid(focused.y, focused.m), [focused.y, focused.m]);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(focused.y, focused.m, 1),
  );
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // 2024-01-01 — dushanba
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(2024, 0, 1 + i)));
  const dayFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
  const today = todayYmd();

  const go = (next: Ymd) => {
    moved.current = true;
    setFocused(next);
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => Ymd> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -weekdayMon(focused)),
      End: () => addDays(focused, 6 - weekdayMon(focused)),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    go(fn());
  };

  const pick = (day: Ymd) => {
    const iso = toIso(day);
    if (inRange(iso, min, max)) onSelect(iso);
  };

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.date.dialog')}
      style={style}
      className="z-popover w-72 animate-scale-in rounded-xl border border-line bg-surface p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={t('ui.date.prevMonth')}
          onClick={() => setFocused(addMonths(focused, -1))}
          className="flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors motion-fast focus-ring hover:bg-surface-sunken"
        >
          <Icon name="chevron-left" size="sm" />
        </button>
        <span id={titleId} aria-live="polite" className="text-sm font-semibold capitalize text-fg">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label={t('ui.date.nextMonth')}
          onClick={() => setFocused(addMonths(focused, 1))}
          className="flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors motion-fast focus-ring hover:bg-surface-sunken"
        >
          <Icon name="chevron-right" size="sm" />
        </button>
      </div>
      <div role="grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown}>
        <div role="row" className="grid grid-cols-7">
          {weekdays.map((w) => (
            <span
              key={w}
              role="columnheader"
              className="py-1 text-center text-xs font-medium capitalize text-fg-subtle"
            >
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div role="row" key={toIso(week[0]!)} className="grid grid-cols-7">
            {week.map((day) => {
              const iso = toIso(day);
              const outside = day.m !== focused.m;
              const isSelected = sameDay(day, selected);
              const isFocused = sameDay(day, focused);
              const allowed = inRange(iso, min, max);
              return (
                <span role="gridcell" key={iso} aria-selected={isSelected} className="p-0.5">
                  <button
                    ref={isFocused ? focusDayRef : undefined}
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={dayFmt.format(new Date(day.y, day.m, day.d))}
                    aria-disabled={!allowed || undefined}
                    aria-current={sameDay(day, today) ? 'date' : undefined}
                    onClick={() => pick(day)}
                    className={cx(
                      'flex h-8 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors motion-fast focus-ring',
                      isSelected
                        ? 'bg-primary font-semibold text-primary-fg'
                        : 'text-fg hover:bg-surface-sunken',
                      outside && !isSelected && 'text-fg-subtle',
                      sameDay(day, today) && !isSelected && 'font-semibold text-primary-subtle-fg',
                      !allowed && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {day.d}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end border-t border-line pt-2">
        <button
          type="button"
          onClick={() => pick(today)}
          className="rounded-md px-2 py-1 text-sm font-medium text-primary-subtle-fg transition-colors motion-fast focus-ring hover:bg-primary-subtle"
        >
          {t('ui.date.today')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
