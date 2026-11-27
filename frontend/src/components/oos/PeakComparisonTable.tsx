import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/date';
import type { MetricStats, PeakComparisonDto, PeakComparisonRow } from '@/types';
import { Alert, Badge, DataTable, type DataTableColumn, DescriptionList, EmptyState } from '@/ui';
import { fmtNum, fmtPct } from './format';

/** Joriy / o'rtacha / Δ% (va RSD) — ixcham ko'rinish. */
function Stat({ s, rsd = false }: { s: MetricStats; rsd?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col text-xs tabular-nums">
      <span className="text-sm font-medium text-fg">{fmtNum(s.current)}</span>
      <span className="text-fg-muted">
        {t('peaks.compare.mean')}: {fmtNum(s.mean)} · {t('peaks.compare.delta')}:{' '}
        {fmtPct(s.deviationPct)}
      </span>
      {rsd && (
        <span className="text-fg-muted">
          {t('peaks.compare.rsd')}: {s.rsdPct === null ? '—' : `${fmtNum(s.rsdPct, 2)}%`}
        </span>
      )}
    </div>
  );
}

/**
 * P19 (D-193): joriy peaklar ↔ tarixiy TASDIQLANGAN peaklar (deterministik, serverda hisoblangan).
 * Belgilar — faqat e'tibor uchun ogohlantirish, hech qachon "o'tdi/o'tmadi" xulosasi emas.
 */
export function PeakComparisonTable({ comparison }: { comparison: PeakComparisonDto }) {
  const { t } = useTranslation();
  const c = comparison;

  const criteria = (
    <DescriptionList
      columns={2}
      items={[
        { label: t('peaks.compare.criteria.substance'), value: c.criteria.substanceName },
        {
          label: t('peaks.compare.criteria.equipment'),
          value: c.criteria.equipmentName ?? t('peaks.compare.criteria.anyEquipment'),
        },
        {
          label: t('peaks.compare.criteria.nd'),
          value: c.criteria.ndId
            ? t('peaks.compare.criteria.sameNd')
            : t('peaks.compare.criteria.anyNd'),
        },
        {
          label: t('peaks.compare.historyRuns'),
          value: (
            <span className="tabular-nums">
              {c.historyRuns}
              {c.historySources.length > 0 &&
                ` (${c.historySources.map((h) => (h.date ? formatDate(h.date) : '—')).join(', ')})`}
            </span>
          ),
        },
      ]}
    />
  );

  if (c.status === 'no_current') {
    return (
      <div className="flex flex-col gap-3">
        {criteria}
        <EmptyState size="sm" icon="layers" title={t('peaks.compare.noCurrent')} />
      </div>
    );
  }
  if (c.status === 'no_history') {
    return (
      <div className="flex flex-col gap-3">
        {criteria}
        <EmptyState size="sm" icon="layers" title={t('peaks.compare.noHistory')} />
      </div>
    );
  }

  const columns: DataTableColumn<PeakComparisonRow>[] = [
    {
      key: 'peak',
      header: t('peaks.columns.peak'),
      primary: true,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-fg">{r.name ?? t('peaks.unnamed')}</span>
          <span className="text-xs text-fg-muted">
            {t('peaks.compare.matchedRuns', { count: r.matchedRuns })}
          </span>
        </div>
      ),
    },
    { key: 'rt', header: t('peaks.columns.rt'), render: (r) => <Stat s={r.rtStats} /> },
    {
      key: 'area',
      header:
        r0Basis(c) === 'area_percent' ? t('peaks.columns.areaPercent') : t('peaks.columns.area'),
      render: (r) => <Stat s={r.areaStats} rsd />,
    },
    {
      key: 'tailing',
      header: t('peaks.columns.tailing'),
      render: (r) => <Stat s={r.tailingStats} />,
    },
    { key: 'plates', header: t('peaks.columns.plates'), render: (r) => <Stat s={r.platesStats} /> },
    {
      key: 'rs',
      header: t('peaks.columns.resolution'),
      render: (r) => <span className="tabular-nums">{fmtNum(r.resolution)}</span>,
    },
    {
      key: 'flags',
      header: t('peaks.compare.flagsTitle'),
      render: (r) =>
        r.flags.length === 0 ? (
          <span className="text-xs text-fg-muted">{'—'}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {r.flags.map((f) => (
              <Badge key={f} size="sm" tone="warning" icon="alert-triangle">
                {t(`peaks.flags.${f}`, f)}
              </Badge>
            ))}
          </span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {criteria}
      {c.singleRun && <Alert tone="info">{t('peaks.compare.singleRun')}</Alert>}
      <DataTable
        columns={columns}
        rows={c.peaks}
        rowKey={(r) => `${r.name ?? ''}-${r.rt}`}
        caption={t('peaks.compare.title')}
        emptyText={t('peaks.compare.noPeaks')}
      />
      {c.missingPeaks.length > 0 && (
        <Alert tone="warning" title={t('peaks.compare.missingTitle')}>
          <ul className="list-inside list-disc">
            {c.missingPeaks.map((m) => (
              <li key={`${m.name ?? ''}-${m.meanRt}`}>
                {t('peaks.compare.missingLine', {
                  name: m.name ?? t('peaks.unnamed'),
                  rt: fmtNum(m.meanRt),
                  runs: m.presentInRuns,
                })}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <p className="text-xs text-fg-muted">
        {t('peaks.compare.thresholds', {
          rt: c.thresholds.rtShiftPct,
          area: c.thresholds.areaDevPct,
          tailing: c.thresholds.tailingMax,
          plates: c.thresholds.platesDropPct,
          rs: c.thresholds.resolutionMin,
        })}{' '}
        {t('peaks.compare.flagsNote')}
      </p>
    </div>
  );
}

/** Maydon asosi (area% yoki area) — birinchi qatordagi qiymat bo'yicha sarlavha. */
function r0Basis(c: PeakComparisonDto) {
  return c.peaks.find((p) => p.areaStats.basis)?.areaStats.basis ?? null;
}
