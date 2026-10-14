import {
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { useDismiss } from '../../lib/useDismiss';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { usePopoverPosition } from '../../lib/usePopoverPosition';

export interface DropdownTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': 'dialog';
}

export interface DropdownProps {
  /** Tugmani chizadi — berilgan prop'lar unga yoyiladi (`<IconButton {...props} />`). */
  trigger: (props: DropdownTriggerProps) => ReactElement;
  /** Panel mazmuni; funksiya bo'lsa `close` uzatiladi. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Panel nomi (ekran o'quvchilar uchun). */
  label: string;
  placement?: 'bottom-start' | 'bottom-end';
  className?: string;
}

/** Ixtiyoriy kontentli ochiluvchi panel (bildirishnomalar, filtrlar): fokus ichkariga, Esc/tashqi bosish yopadi. */
export function Dropdown({
  trigger,
  children,
  label,
  placement = 'bottom-end',
  className,
}: DropdownProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const style = usePopoverPosition(triggerRef, panelRef, open, { placement });
  useFocusTrap(panelRef, { active: open, onEscape: close });
  useDismiss([triggerRef, panelRef], open, close);

  const triggerProps: DropdownTriggerProps = {
    ref: triggerRef,
    onClick: () => setOpen((o) => !o),
    'aria-expanded': open,
    'aria-controls': panelId,
    'aria-haspopup': 'dialog',
  };

  return (
    <>
      {trigger(triggerProps)}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={style}
            className={cx(
              'z-popover min-w-popover animate-scale-in rounded-xl border border-line bg-surface text-fg shadow-lg outline-none',
              className,
            )}
          >
            {typeof children === 'function' ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}
