/**
 * D-193: peaklarni tarixiy (tasdiqlangan) peaklar bilan DETERMINISTIK solishtirish — LLM arifmetika qilmaydi.
 * Natija strukturaviy JSON; chat'da LLM ga FAKT sifatida beriladi.
 *
 * Moslashtirish: avval nom bo'yicha (normallashtirilgan), bo'lmasa RT bo'yicha eng yaqini ±RT_MATCH_WINDOW_PCT.
 * Chegaralar evristik (farmakopeyadagi odatiy tizim muvofiqligi qiymatlari), qaror emas — faqat belgi.
 */

export interface PeakPoint {
  name: string | null;
  rt: number;
  area: number | null;
  areaPercent: number | null;
  tailing: number | null;
  plates: number | null;
  resolution: number | null;
}

export interface HistoricalRun {
  protocolId: string;
  peakFileId: string;
  date: string | null;
  peaks: PeakPoint[];
}

export const PEAK_THRESHOLDS = {
  /** RT siljishi, % (o'rtachaga nisbatan) */
  rtShiftPct: 2,
  /** Yuza (%area, bo'lmasa absolyut yuza) og'ishi, % */
  areaDevPct: 10,
  /** Simmetriya (tailing) yuqori chegarasi (USP/Ph.Eur. odatiy ≤ 2.0) */
  tailingMax: 2,
  tailingChangePct: 20,
  /** Nazariy plastinkalar kamayishi, % */
  platesDropPct: 25,
  /** Rezolyutsiya quyi chegarasi */
  resolutionMin: 1.5,
  /** Nomsiz peaklarni RT bo'yicha moslashtirish oynasi, % */
  rtMatchWindowPct: 5,
  /** Yo'qolgan peak: tarixiy yugurishlarning kamida shu ulushida bo'lgan */
  missingPresenceRatio: 0.5,
} as const;

export type PeakFlag =
  | 'rt_shift'
  | 'area_deviation'
  | 'tailing_high'
  | 'tailing_change'
  | 'plates_drop'
  | 'low_resolution'
  | 'new_peak';

export interface MetricStats {
  current: number | null;
  n: number;
  mean: number | null;
  sd: number | null;
  rsdPct: number | null;
  deviationPct: number | null;
}

export interface PeakComparisonRow {
  name: string | null;
  rt: number;
  matchedRuns: number;
  rtStats: MetricStats;
  areaStats: MetricStats & { basis: 'area_percent' | 'area' | null };
  tailingStats: MetricStats;
  platesStats: MetricStats;
  resolution: number | null;
  flags: PeakFlag[];
}

export interface MissingPeak {
  name: string | null;
  meanRt: number;
  presentInRuns: number;
}

export interface PeakComparison {
  status: 'no_current' | 'no_history' | 'compared';
  historyRuns: number;
  /** Tarixda bitta yugurish — RSD hisoblanmaydi */
  singleRun: boolean;
  peaks: PeakComparisonRow[];
  missingPeaks: MissingPeak[];
  flags: PeakFlag[];
  thresholds: typeof PEAK_THRESHOLDS;
}

const r = (v: number | null, d = 3): number | null =>
  v === null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;

const nameKey = (n: string | null) => (n ? n.trim().replace(/\s+/g, ' ').toLowerCase() : null);

export function stats(current: number | null, values: number[]): MetricStats {
  const n = values.length;
  if (!n) return { current, n: 0, mean: null, sd: null, rsdPct: null, deviationPct: null };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = n >= 2 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : null;
  const rsdPct = sd !== null && mean !== 0 ? (sd / Math.abs(mean)) * 100 : null;
  const deviationPct = current !== null && mean !== 0 ? ((current - mean) / Math.abs(mean)) * 100 : null;
  return { current, n, mean: r(mean, 4), sd: r(sd, 4), rsdPct: r(rsdPct), deviationPct: r(deviationPct) };
}

/** Yugurishdagi mos peak: nom (ikkalasida bo'lsa) yoki RT oynasidagi eng yaqini; har peak bir marta. */
function matchIn(peak: PeakPoint, run: PeakPoint[], used: Set<number>): number {
  const key = nameKey(peak.name);
  if (key) {
    const i = run.findIndex((p, idx) => !used.has(idx) && nameKey(p.name) === key);
    if (i >= 0) return i;
  }
  let best = -1;
  let bestDiff = Infinity;
  run.forEach((p, idx) => {
    if (used.has(idx)) return;
    // Ikkalasi ham nomlangan, lekin nomlar boshqa — bu boshqa komponent
    if (key && nameKey(p.name) && nameKey(p.name) !== key) return;
    const diff = Math.abs(p.rt - peak.rt);
    if (diff <= (peak.rt * PEAK_THRESHOLDS.rtMatchWindowPct) / 100 && diff < bestDiff) {
      best = idx;
      bestDiff = diff;
    }
  });
  return best;
}

export function comparePeaks(current: PeakPoint[], history: HistoricalRun[]): PeakComparison {
  const base = { historyRuns: history.length, singleRun: history.length === 1, thresholds: PEAK_THRESHOLDS };
  if (!current.length) return { status: 'no_current', peaks: [], missingPeaks: [], flags: [], ...base };
  const sorted = [...current].sort((a, b) => a.rt - b.rt);
  if (!history.length) {
    return {
      status: 'no_history',
      peaks: sorted.map((p) => ({
        name: p.name,
        rt: p.rt,
        matchedRuns: 0,
        rtStats: stats(p.rt, []),
        areaStats: { ...stats(p.areaPercent ?? p.area, []), basis: null },
        tailingStats: stats(p.tailing, []),
        platesStats: stats(p.plates, []),
        resolution: p.resolution,
        // Tarixsiz ham mutlaq chegaralar tekshiriladi
        flags: absoluteFlags(p),
      })),
      missingPeaks: [],
      flags: [...new Set(sorted.flatMap(absoluteFlags))],
      ...base,
    };
  }

  // Har tarixiy yugurishda joriy peaklarga mos kelganlar
  const usedPerRun = history.map(() => new Set<number>());
  const matches = sorted.map((p) =>
    history.map((run, ri) => {
      const idx = matchIn(p, run.peaks, usedPerRun[ri]!);
      if (idx >= 0) usedPerRun[ri]!.add(idx);
      return idx >= 0 ? run.peaks[idx]! : null;
    }),
  );

  const rows: PeakComparisonRow[] = sorted.map((p, i) => {
    const matched = matches[i]!.filter((m): m is PeakPoint => m !== null);
    const useAreaPct = p.areaPercent !== null && matched.some((m) => m.areaPercent !== null);
    const areaBasis: 'area_percent' | 'area' | null = useAreaPct ? 'area_percent' : p.area !== null ? 'area' : null;
    const areaVals = matched
      .map((m) => (useAreaPct ? m.areaPercent : m.area))
      .filter((v): v is number => v !== null);
    const rtStats = stats(p.rt, matched.map((m) => m.rt));
    const areaStats = { ...stats(useAreaPct ? p.areaPercent : p.area, areaBasis ? areaVals : []), basis: areaBasis };
    const tailingStats = stats(p.tailing, matched.map((m) => m.tailing).filter((v): v is number => v !== null));
    const platesStats = stats(p.plates, matched.map((m) => m.plates).filter((v): v is number => v !== null));
    const flags: PeakFlag[] = [...absoluteFlags(p)];
    if (!matched.length) flags.push('new_peak');
    if (rtStats.deviationPct !== null && Math.abs(rtStats.deviationPct) > PEAK_THRESHOLDS.rtShiftPct) flags.push('rt_shift');
    if (areaStats.deviationPct !== null && Math.abs(areaStats.deviationPct) > PEAK_THRESHOLDS.areaDevPct)
      flags.push('area_deviation');
    if (tailingStats.deviationPct !== null && Math.abs(tailingStats.deviationPct) > PEAK_THRESHOLDS.tailingChangePct)
      flags.push('tailing_change');
    if (platesStats.deviationPct !== null && platesStats.deviationPct < -PEAK_THRESHOLDS.platesDropPct)
      flags.push('plates_drop');
    return {
      name: p.name,
      rt: p.rt,
      matchedRuns: matched.length,
      rtStats,
      areaStats,
      tailingStats,
      platesStats,
      resolution: p.resolution,
      flags,
    };
  });

  // Yo'qolgan peaklar: tarixda tez-tez bo'lgan, joriyda mos kelmaganlar (nom yoki RT klasteri)
  const leftovers: { name: string | null; rt: number; run: number }[] = [];
  history.forEach((run, ri) =>
    run.peaks.forEach((p, idx) => {
      if (!usedPerRun[ri]!.has(idx)) leftovers.push({ name: p.name, rt: p.rt, run: ri });
    }),
  );
  const clusters: { name: string | null; rts: number[]; runs: Set<number> }[] = [];
  for (const lo of leftovers.sort((a, b) => a.rt - b.rt)) {
    const key = nameKey(lo.name);
    const c = clusters.find((cl) =>
      key && nameKey(cl.name)
        ? nameKey(cl.name) === key
        : Math.abs(cl.rts[0]! - lo.rt) <= (cl.rts[0]! * PEAK_THRESHOLDS.rtMatchWindowPct) / 100,
    );
    if (c) {
      c.rts.push(lo.rt);
      c.runs.add(lo.run);
    } else clusters.push({ name: lo.name, rts: [lo.rt], runs: new Set([lo.run]) });
  }
  const missingPeaks = clusters
    .filter((c) => c.runs.size / history.length >= PEAK_THRESHOLDS.missingPresenceRatio)
    .map((c) => ({
      name: c.name,
      meanRt: r(c.rts.reduce((s, v) => s + v, 0) / c.rts.length, 4)!,
      presentInRuns: c.runs.size,
    }));

  const flags = [...new Set(rows.flatMap((row) => row.flags))];
  return { status: 'compared', peaks: rows, missingPeaks, flags, ...base };
}

function absoluteFlags(p: PeakPoint): PeakFlag[] {
  const f: PeakFlag[] = [];
  if (p.tailing !== null && p.tailing > PEAK_THRESHOLDS.tailingMax) f.push('tailing_high');
  if (p.resolution !== null && p.resolution < PEAK_THRESHOLDS.resolutionMin) f.push('low_resolution');
  return f;
}
