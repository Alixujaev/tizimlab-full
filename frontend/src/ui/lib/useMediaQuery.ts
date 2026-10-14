import { useSyncExternalStore } from 'react';

/** CSS media query holati. `matchMedia` yo'q muhitda (jsdom) — `fallback`. */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

export const DESKTOP_QUERY = '(min-width: 768px)';
