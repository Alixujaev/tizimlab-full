import { type RefObject, useEffect, useRef } from 'react';

/** Berilgan elementlardan tashqarida bosilganda `onDismiss` chaqiriladi (dropdown/popover yopilishi). */
export function useDismiss(
  refs: Array<RefObject<HTMLElement | null>>,
  active: boolean,
  onDismiss: () => void,
): void {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node | null;
      if (refsRef.current.some((r) => r.current?.contains(target))) return;
      cb.current();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [active]);
}
