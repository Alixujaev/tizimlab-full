import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatDate } from '@/lib/date';
import type { ChatMessageDto, ChatSourceDto } from '@/types';
import { Alert, Badge, Button, Icon } from '@/ui';
import { PeakComparisonTable } from './PeakComparisonTable';

/** Manba belgisi [S1]: ilova ichidagi havola (bo'lsa), aks holda oddiy belgi. */
export function SourceChip({ refId, source }: { refId: string; source?: ChatSourceDto }) {
  const label = `[${refId}]`;
  if (source?.link) {
    return (
      <Link
        to={source.link}
        title={source.title}
        className="inline-flex items-center rounded-md border border-primary-line bg-primary-subtle px-1.5 py-0.5 font-mono text-xs text-primary-subtle-fg transition-colors motion-fast focus-ring hover:bg-primary hover:text-primary-fg"
      >
        {label}
      </Link>
    );
  }
  return (
    <Badge size="sm" className="font-mono">
      {label}
    </Badge>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-fg">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg-muted">{children}</p>;
}

/**
 * P19: AI kopilot javobi — 5 bo'lim (ichki baza, peak, ehtimoliy sabablar, tekshiruvlar, umumiy bilim),
 * manbalar va doimiy ogohlantirish. Hech qanday element "o'tdi/o'tmadi" yoki OOS xulosasi sifatida ko'rsatilmaydi.
 */
export function ChatAnswer({ message }: { message: ChatMessageDto }) {
  const { t } = useTranslation();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const a = message.answer;

  if (!a) {
    return (
      <Alert tone="warning" title={t('oos.answer.failedTitle')}>
        {t('oos.answer.failed')}
      </Alert>
    );
  }

  const byRef = new Map(message.sources.map((s) => [s.ref, s]));
  const comparisons = message.peakComparison ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="sm" tone="primary" icon="info">
          {t('oos.answer.aiBadge')}
        </Badge>
        {message.retrievalMode === 'fts_only' && (
          <Badge size="sm" tone="neutral" icon="search">
            {t('oos.answer.ftsOnly')}
          </Badge>
        )}
      </div>

      {/* (a) Ichki bazadan topilganlar */}
      <Section title={t('oos.answer.internal')}>
        {a.internalFound && a.internal_findings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {a.internal_findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fg">
                <SourceChip refId={f.source_ref} source={byRef.get(f.source_ref)} />
                <span className="min-w-0 break-words">{f.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Alert tone="warning">{t('oos.answer.internalNotFound')}</Alert>
        )}
      </Section>

      {/* (b) Peak taqqoslash */}
      <Section title={t('oos.answer.peaks')}>
        {comparisons.length === 0 && !a.peak_assessment ? (
          <Empty>{t('oos.answer.noPeaks')}</Empty>
        ) : (
          <>
            {comparisons.map((c) => (
              <PeakComparisonTable key={c.peakFileId} comparison={c} />
            ))}
            {a.peak_assessment && (
              <p className="whitespace-pre-line text-sm text-fg">{a.peak_assessment}</p>
            )}
          </>
        )}
      </Section>

      {/* (c) Ehtimoliy sabablar */}
      <Section title={t('oos.answer.causes')}>
        {a.probable_causes.length === 0 ? (
          <Empty>{t('oos.answer.none')}</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {a.probable_causes.map((c, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-md bg-surface-muted px-3 py-2">
                <span className="text-sm text-fg">{c.cause}</span>
                <span className="flex flex-wrap items-center gap-1">
                  {c.basis === 'internal' ? (
                    <>
                      <Badge size="sm" tone="info">
                        {t('oos.answer.basisInternal')}
                      </Badge>
                      {c.source_refs.map((r) => (
                        <SourceChip key={r} refId={r} source={byRef.get(r)} />
                      ))}
                    </>
                  ) : (
                    <Badge size="sm" tone="warning" icon="alert-triangle">
                      {t('oos.answer.basisGeneral')}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* (d) Tavsiya etilgan tekshiruvlar */}
      <Section title={t('oos.answer.checks')}>
        {a.recommended_checks.length === 0 ? (
          <Empty>{t('oos.answer.none')}</Empty>
        ) : (
          <ol className="flex list-inside list-decimal flex-col gap-1 text-sm text-fg">
            {a.recommended_checks.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        )}
      </Section>

      {/* (e) Umumiy analitik bilim — ichki bazadan EMAS */}
      <Section
        title={t('oos.answer.general')}
        aside={
          <Badge size="sm" tone="warning" icon="alert-triangle">
            {t('oos.answer.generalWarning')}
          </Badge>
        }
      >
        {a.general_knowledge.length === 0 ? (
          <Empty>{t('oos.answer.none')}</Empty>
        ) : (
          <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-fg">
            {a.general_knowledge.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </Section>

      {message.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            rightIcon={sourcesOpen ? 'chevron-up' : 'chevron-down'}
            aria-expanded={sourcesOpen}
            onClick={() => setSourcesOpen((v) => !v)}
          >
            {t('oos.answer.sources', { count: message.sources.length })}
          </Button>
          {sourcesOpen && (
            <ul className="flex flex-col gap-2">
              {message.sources.map((s) => (
                <li
                  key={s.ref}
                  className="flex flex-col gap-1 rounded-md border border-line px-3 py-2"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <SourceChip refId={s.ref} source={s} />
                    <Badge size="sm">{t(`oos.sourceType.${s.sourceType}`, s.sourceType)}</Badge>
                    <span className="font-medium text-fg">{s.title}</span>
                    {s.cited && (
                      <Badge size="sm" tone="info">
                        {t('oos.answer.cited')}
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {[s.substanceName, s.series, s.docDate ? formatDate(s.docDate) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <p className="whitespace-pre-line text-xs text-fg-muted">{s.excerpt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2 text-xs text-fg-muted">
        <Icon name="shield" size="sm" className="mt-0.5 shrink-0" />
        <span>{t('oos.answer.disclaimer')}</span>
      </p>
    </div>
  );
}
