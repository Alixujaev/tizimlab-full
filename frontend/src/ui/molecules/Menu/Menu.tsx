import {
  type KeyboardEvent,
  type ReactElement,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../../atoms/Icon';
import { cx } from '../../lib/cx';
import { useDismiss } from '../../lib/useDismiss';
import { usePopoverPosition } from '../../lib/usePopoverPosition';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
  tone?: 'danger';
  disabled?: boolean;
  /** Tanlov menyusi (til, mavzu): `menuitemradio` + `aria-checked`. */
  checked?: boolean;
}

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  id: string;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
}

export interface MenuProps {
  trigger: (props: MenuTriggerProps) => ReactElement;
  items: ReadonlyArray<MenuItem>;
  placement?: 'bottom-start' | 'bottom-end';
  className?: string;
}

/**
 * Amallar menyusi (WAI-ARIA menu button): ↓/Enter/Space ochib birinchisiga, ↑ oxirgisiga fokus;
 * ↑↓ Home End harakat, harf — mos bandga, Enter/Space tanlash, Esc yopib fokusni qaytaradi, Tab yopadi.
 */
export function Menu({ trigger, items, placement = 'bottom-end', className }: MenuProps) {
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const style = usePopoverPosition(triggerRef, menuRef, open, { placement });
  const close = useCallback(() => setOpen(false), []);
  useDismiss([triggerRef, menuRef], open, close);

  const enabled = items.flatMap((it, i) => (it.disabled ? [] : [i]));

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  const openAt = (index: number | undefined) => {
    if (index === undefined) return;
    setFocusIndex(index);
    setOpen(true);
  };

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openAt(enabled[0]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openAt(enabled.at(-1));
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const pos = enabled.indexOf(focusIndex);
    const go = (i: number | undefined) => {
      e.preventDefault();
      if (i !== undefined) setFocusIndex(i);
    };
    switch (e.key) {
      case 'ArrowDown':
        return go(enabled[(pos + 1) % enabled.length]);
      case 'ArrowUp':
        return go(enabled[(pos - 1 + enabled.length) % enabled.length]);
      case 'Home':
        return go(enabled[0]);
      case 'End':
        return go(enabled.at(-1));
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        return closeAndFocus();
      case 'Tab':
        return setOpen(false);
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const ch = e.key.toLocaleLowerCase();
          const ordered = [...enabled.slice(pos + 1), ...enabled.slice(0, pos + 1)];
          go(ordered.find((i) => items[i]!.label.toLocaleLowerCase().startsWith(ch)));
        }
    }
  };

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    id: triggerId,
    onClick: () => (open ? setOpen(false) : openAt(enabled[0])),
    onKeyDown: onTriggerKeyDown,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': menuId,
  };

  return (
    <>
      {trigger(triggerProps)}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            style={style}
            onKeyDown={onMenuKeyDown}
            className={cx(
              'z-popover min-w-popover animate-scale-in rounded-xl border border-line bg-surface p-1 shadow-lg',
              className,
            )}
          >
            {items.map((item, i) => {
              const radio = item.checked !== undefined;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role={radio ? 'menuitemradio' : 'menuitem'}
                  aria-checked={radio ? item.checked : undefined}
                  tabIndex={i === focusIndex ? 0 : -1}
                  disabled={item.disabled}
                  onClick={() => {
                    closeAndFocus();
                    item.onSelect();
                  }}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors motion-fast',
                    'focus-visible:bg-surface-sunken hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50',
                    item.tone === 'danger' ? 'text-danger-fg' : 'text-fg',
                  )}
                >
                  {item.icon && <Icon name={item.icon} size="sm" className="text-fg-subtle" />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.checked && <Icon name="check" size="sm" className="text-primary" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
