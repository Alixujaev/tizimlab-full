import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePopoverPosition } from '../../lib/usePopoverPosition';

const SHOW_DELAY_MS = 300;

export interface TooltipProps {
  content: ReactNode;
  /** Fokuslanadigan bitta element (tugma, havola). */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  delay?: number;
}

/** Qo'shimcha izoh: sichqoncha (kechikish bilan) va klaviatura fokusida ko'rinadi, Esc bilan yopiladi. */
export function Tooltip({ content, children, delay = SHOW_DELAY_MS }: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const style = usePopoverPosition(anchorRef, tipRef, open, { placement: 'top', offset: 6 });

  const show = (immediate = false) => {
    clearTimeout(timer.current);
    if (immediate) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const describedBy = [children.props['aria-describedby'], open ? id : null]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onMouseEnter={() => show()}
        onMouseLeave={hide}
        onFocus={() => show(true)}
        onBlur={hide}
      >
        {cloneElement(children, { 'aria-describedby': describedBy || undefined })}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={style}
            className="pointer-events-none z-tooltip max-w-tooltip animate-fade-in rounded-md bg-fg px-2 py-1 text-xs text-canvas shadow-md"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
