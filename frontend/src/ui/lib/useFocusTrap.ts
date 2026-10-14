import { type RefObject, useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true',
  );
}

// Ichma-ich qatlamlar (modal ichida kalendar) — klaviaturani faqat eng ustki qatlam boshqaradi
const trapStack: symbol[] = [];

interface FocusTrapOptions {
  active: boolean;
  onEscape?: () => void;
  /** Ochilganda fokuslanadigan element; berilmasa — birinchi fokuslanuvchi, u ham bo'lmasa konteyner. */
  initialFocus?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
}

/** Fokusni konteyner ichida ushlaydi (Tab/Shift+Tab aylanadi), Esc bilan yopadi, yopilganda fokusni qaytaradi. */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { active, onEscape, initialFocus, restoreFocus = true }: FocusTrapOptions,
): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const id = Symbol('trap');
    trapStack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = ref.current;
    (initialFocus?.current ?? getFocusable(container)[0] ?? container)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== id || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (!onEscapeRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const items = getFocusable(container);
      if (!items.length) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (!container.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      trapStack.splice(trapStack.indexOf(id), 1);
      if (restoreFocus) previouslyFocused?.focus?.();
    };
    // initialFocus/restoreFocus faqat ochilish paytida o'qiladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref]);
}
