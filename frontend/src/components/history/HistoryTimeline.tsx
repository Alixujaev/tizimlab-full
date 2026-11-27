import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistoryQuery } from '@/hooks/useAi';
import { formatDateTime } from '@/lib/date';
import type { AiReviewChange, HistoryEntity, HistoryItemDto, HistoryItemType } from '@/types';
import { Badge, EmptyState, ErrorState, Icon, type IconName, Skeleton, type Tone } from '@/ui';

/** AI review maydon kalitlari → mavjud forma yorliqlari (D-189: "maydon: AI qiymati → yakuniy qiymat"). */
const FIELD_LABELS: Record<HistoryEntity, Record<string, string>> = {
  sample: {
    substanceName: 'samples.substanceName',
    serialNumber: 'samples.serialNumber',
    manufacturer: 'samples.manufacturer',
    manufacturedAt: 'samples.manufacturedAt',
    expiryDate: 'samples.expiryDate',
    quantity: 'samples.quantity',
    arrivalDate: 'samples.arrivalDate',
    analysisEnd: 'samples.analysisEnd',
  },
  reagent: {
    name: 'reagents.name',
    lotNumber: 'reagents.lot.lotNumber',
    manufacturer: 'reagents.lot.manufacturer',
    manufacturedAt: 'reagents.lot.manufacturedAt',
    expiresAt: 'reagents.expiresAt',
    quantity: 'reagents.quantity',
    unit: 'reagents.unit',
    arrivalDate: 'reagents.lot.arrivalDate',
  },
  nd: {
    methodName: 'nd.methodName',
    equipmentCategory: 'equipment.category',
    reagentItemId: 'nd.reagent',
    quantity: 'nd.quantityPerAnalysis',
    unit: 'nd.unit',
  },
};

const TYPE_META: Record<HistoryItemType, { icon: IconName; tone: Tone }> = {
  sample_event: { icon: 'flask', tone: 'neutral' },
  protocol_signed: { icon: 'shield-check', tone: 'success' },
  protocol_rejected: { icon: 'x-circle', tone: 'danger' },
  consumption: { icon: 'beaker', tone: 'info' },
  consumption_reviewed: { icon: 'check-circle', tone: 'info' },
  ai_review: { icon: 'file-text', tone: 'primary' },
  reagent_transaction: { icon: 'package', tone: 'neutral' },
  reagent_approval: { icon: 'check', tone: 'success' },
  nd_status: { icon: 'file-text', tone: 'neutral' },
  nd_ai_extract: { icon: 'file-text', tone: 'primary' },
};

const FALLBACK_META: { icon: IconName; tone: Tone } = { icon: 'clock', tone: 'neutral' };

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function Reason({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-1.5 rounded-lg border border-warning-line bg-warning-subtle px-3 py-2 text-xs text-fg">
      <span className="font-medium text-warning-fg">{label}:</span> {children}
    </p>
  );
}

/** Bitta voqea: sarlavha va (turiga qarab) tafsilot. */
function useRenderItem(entity: HistoryEntity) {
  const { t } = useTranslation();

  const fieldLabel = (field: string) => {
    // ND: "<talab>.<maydon>" — talab nomi o'zicha, maydon tarjima qilinadi
    const dot = field.lastIndexOf('.');
    const prefix = dot > 0 ? field.slice(0, dot) : '';
    const name = dot > 0 ? field.slice(dot + 1) : field;
    const key = FIELD_LABELS[entity][name];
    const label = key ? t(key) : name;
    return prefix ? `${prefix} — ${label}` : label;
  };
  const value = (v: unknown) => (str(v) === '' ? t('history.noValue') : str(v));

  return (item: HistoryItemDto): { title: string; body?: ReactNode } => {
    const d = item.data;
    switch (item.type) {
      case 'sample_event':
        return {
          title: t(`samples.events.${str(d.event)}`, str(d.event)),
          body: (
            <>
              {(d.from || d.to) && (
                <p className="text-xs text-fg-muted">
                  {t('history.statusChange', {
                    from: d.from ? t(`samples.status.${str(d.from)}`, str(d.from)) : '—',
                    to: d.to ? t(`samples.status.${str(d.to)}`, str(d.to)) : '—',
                  })}
                </p>
              )}
              {Boolean(d.reason) && <Reason label={t('history.reason')}>{str(d.reason)}</Reason>}
            </>
          ),
        };
      case 'protocol_signed':
        return {
          title: t(`history.protocolSigned.${str(d.action)}`, str(d.action)),
          body: d.protocolRole ? (
            <p className="text-xs text-fg-muted">
              {t(`protocols.roles.${str(d.protocolRole)}`, str(d.protocolRole))}
            </p>
          ) : undefined,
        };
      case 'protocol_rejected':
        return {
          title: t('history.protocolRejected'),
          body: (
            <>
              {Boolean(d.protocolRole) && (
                <p className="text-xs text-fg-muted">
                  {t(`protocols.roles.${str(d.protocolRole)}`, str(d.protocolRole))}
                </p>
              )}
              <Reason label={t('history.reason')}>{str(d.reason)}</Reason>
            </>
          ),
        };
      case 'consumption':
        return {
          title: t('history.consumption'),
          body: (
            <p className="text-xs text-fg-muted">
              {d.reagentName
                ? t('history.consumptionLine', {
                    name: str(d.reagentName),
                    consumed: str(d.consumed),
                    required: str(d.required),
                    unit: str(d.unit),
                  })
                : t('history.consumptionReagentLine', {
                    quantity: str(d.quantity),
                    substance: str(d.substanceName),
                  })}
              {Number(d.shortfall) > 0 && (
                <span className="block font-medium text-danger-fg">
                  {t('protocols.consumption.shortfall', {
                    qty: str(d.shortfall),
                    unit: str(d.unit),
                  })}
                </span>
              )}
            </p>
          ),
        };
      case 'consumption_reviewed':
        return {
          title: t(`history.consumptionReviewed.${str(d.status)}`, str(d.status)),
          body: (
            <>
              <p className="text-xs text-fg-muted">
                {t('history.consumptionReviewedLine', {
                  name: str(d.reagentName),
                  consumed: str(d.consumed),
                  unit: str(d.unit),
                })}
              </p>
              {Boolean(d.reason) && <Reason label={t('history.reason')}>{str(d.reason)}</Reason>}
            </>
          ),
        };
      case 'ai_review': {
        const changed = (Array.isArray(d.changed) ? d.changed : []) as AiReviewChange[];
        const accepted = Array.isArray(d.accepted) ? d.accepted.length : 0;
        return {
          title: t('history.aiReview'),
          body: (
            <div className="flex flex-col gap-1">
              {changed.length > 0 && (
                <ul className="flex flex-col gap-1 text-xs">
                  {changed.map((c) => (
                    <li key={c.field} className="text-fg">
                      <span className="font-medium">{fieldLabel(c.field)}:</span>{' '}
                      <span className="text-fg-muted line-through">{value(c.aiValue)}</span>{' '}
                      <Icon name="chevron-right" size="xs" className="inline text-fg-subtle" />{' '}
                      <span className="font-medium">{value(c.finalValue)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-fg-muted">
                {t('history.aiAccepted', { count: accepted })}
              </p>
            </div>
          ),
        };
      }
      case 'reagent_transaction':
        return {
          title: t(`reagents.types.${str(d.kind)}`, str(d.kind)),
          body: (
            <>
              <p className="text-xs tabular-nums text-fg-muted">
                {t('history.transactionLine', {
                  quantity: str(d.quantity),
                  before: str(d.before),
                  after: str(d.after),
                })}
              </p>
              {Boolean(d.note) && <p className="text-xs text-fg-muted">{str(d.note)}</p>}
            </>
          ),
        };
      case 'reagent_approval':
        return {
          title: t(`history.reagentApproval.${str(d.status)}`, str(d.status)),
          body: d.reason ? <Reason label={t('history.reason')}>{str(d.reason)}</Reason> : undefined,
        };
      case 'nd_status':
        return {
          title: t('history.ndStatus', {
            from: d.old ? t(`nd.status.${str(d.old)}`, str(d.old)) : '—',
            to: d.new ? t(`nd.status.${str(d.new)}`, str(d.new)) : '—',
          }),
        };
      case 'nd_ai_extract': {
        const n = (d.new ?? {}) as { created?: number; skipped?: number };
        return {
          title: t('history.ndAiExtract'),
          body: (
            <p className="text-xs text-fg-muted">
              {t('history.ndAiExtractLine', { created: n.created ?? 0, skipped: n.skipped ?? 0 })}
            </p>
          ),
        };
      }
      default:
        return { title: str(item.type) };
    }
  };
}

/**
 * P18 (D-189): yagona tarix — sarf, AI maydon o'zgarishlari (AI → yakuniy), rad etish sabablari, tasdiqlashlar.
 * Mavjud kuzatuv (SampleTrackingTimeline) o'rnini bosmaydi — yonida turadi.
 */
export function HistoryTimeline({ entity, id }: { entity: HistoryEntity; id: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useHistoryQuery(entity, id);
  const render = useRenderItem(entity);

  if (isLoading) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton variant="rect" className="h-16 w-full" />
      </div>
    );
  }
  if (isError) return <ErrorState size="sm" onRetry={() => void refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState size="sm" icon="clock" title={t('history.empty')} />;
  }

  return (
    <ol className="flex flex-col gap-4" aria-label={t('history.title')}>
      {data.map((item) => {
        const meta = TYPE_META[item.type] ?? FALLBACK_META;
        const { title, body } = render(item);
        return (
          <li key={item.id} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
              <Icon name={meta.icon} size="sm" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">{title}</span>
                {item.type === 'ai_review' || item.type === 'nd_ai_extract' ? (
                  <Badge size="sm" tone={meta.tone}>
                    {t('ai.badge')}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-fg-subtle">
                <time dateTime={item.at} className="tabular-nums">
                  {formatDateTime(item.at)}
                </time>
                {item.actorName ? ` · ${item.actorName}` : ''}
              </p>
              {body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
