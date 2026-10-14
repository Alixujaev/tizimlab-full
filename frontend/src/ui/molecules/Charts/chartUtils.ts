import { useLayoutEffect, useRef, useState } from 'react';

/** Kategorial ranglar — qat'iy tartibda (tsiklsiz); 6 dan ortig'i "boshqa" ga yig'iladi. */
export const SERIES_FILL = [
  'fill-chart-1',
  'fill-chart-2',
  'fill-chart-3',
  'fill-chart-4',
  'fill-chart-5',
  'fill-chart-6',
] as const;
export const SERIES_STROKE = [
  'stroke-chart-1',
  'stroke-chart-2',
  'stroke-chart-3',
  'stroke-chart-4',
  'stroke-chart-5',
  'stroke-chart-6',
] as const;
export const SERIES_BG = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
] as const;
export const MAX_SERIES = SERIES_FILL.length;
/** Ketma-ket shkala (heatmap): 0 — bo'sh, 4 — eng to'q. */
export const SEQ_FILL = [
  'fill-chart-seq-0',
  'fill-chart-seq-1',
  'fill-chart-seq-2',
  'fill-chart-seq-3',
  'fill-chart-seq-4',
] as const;
export const SEQ_BG = [
  'bg-chart-seq-0',
  'bg-chart-seq-1',
  'bg-chart-seq-2',
  'bg-chart-seq-3',
  'bg-chart-seq-4',
] as const;

export const seriesIndex = (i: number) => Math.min(i, MAX_SERIES - 1);

/** "Chiroyli" yuqori chegara va qadam (1, 2, 5 × 10ⁿ). */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const isInt = Number.isInteger(max);
  const s = isInt ? Math.max(1, Math.round(step)) : step;
  return { max: Math.ceil(max / s) * s, step: s };
}

/** Konteyner kengligi (px). ResizeObserver yo'q muhitda (jsdom) — `fallback`. */
export function useChartWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** n ta yorliqdan ko'pi bilan `max` tasini teng oraliqda tanlaydi (o'qdagi to'qnashuvlarsiz). */
export function thinIndexes(n: number, max: number): Set<number> {
  if (n <= max) return new Set(Array.from({ length: n }, (_, i) => i));
  const step = (n - 1) / (max - 1);
  return new Set(Array.from({ length: max }, (_, i) => Math.round(i * step)));
}
