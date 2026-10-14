import { type CSSProperties, type RefObject, useLayoutEffect, useState } from 'react';

export type Placement = 'bottom-start' | 'bottom-end' | 'top';

/**
 * Portal'dagi popover'ni anchor'ga nisbatan `position: fixed` bilan joylashtiradi (modal/jadval
 * `overflow` i kesib qo'ymasligi uchun). Pastda joy yetmasa — tepaga ochiladi.
 */
export function usePopoverPosition(
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  open: boolean,
  { placement = 'bottom-start', matchWidth = false, offset = 4 } = {},
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const pop = popoverRef.current?.getBoundingClientRect();
      const popHeight = pop?.height ?? 0;
      const popWidth = pop?.width ?? anchor.width;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = vh - anchor.bottom;
      const above = anchor.top;
      const openUp = placement === 'top' || (popHeight > below - offset && above > below);
      const top = openUp ? anchor.top - popHeight - offset : anchor.bottom + offset;
      let left =
        placement === 'bottom-end'
          ? anchor.right - popWidth
          : placement === 'top'
            ? anchor.left + anchor.width / 2 - popWidth / 2
            : anchor.left;
      left = Math.max(offset, Math.min(left, vw - popWidth - offset));
      setStyle({
        position: 'fixed',
        top: Math.max(offset, top),
        left,
        ...(matchWidth ? { minWidth: anchor.width } : {}),
      });
    };
    update();
    // Popover o'lchami birinchi renderdan keyin ma'lum bo'ladi
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, popoverRef, placement, matchWidth, offset]);

  return style;
}
