import { useTranslation } from 'react-i18next';
import type { SampleTrackingDto } from '@/types';
import { EmptyState, Icon } from '@/ui';
import { SampleStatusBadge } from './SampleStatusBadge';

interface SampleTrackingTimelineProps {
  tracking: SampleTrackingDto[];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function SampleTrackingTimeline({ tracking }: SampleTrackingTimelineProps) {
  const { t } = useTranslation();

  if (!tracking || tracking.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon="clock"
        title={t('samples.noTrackingEvents', 'Hozircha harakatlar tarixi mavjud emas')}
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {tracking.map((event, idx) => {
        const isLast = idx === tracking.length - 1;
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-4 top-9 -ml-px h-full w-0.5 bg-line"
              />
            )}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold tabular-nums text-primary-subtle-fg ring-4 ring-surface">
              {tracking.length - idx}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1 sm:flex-row sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-fg">
                    {t(`samples.events.${event.eventType}`, event.eventType)}
                  </span>
                  {event.userFullName && (
                    <span className="text-xs text-fg-muted">{event.userFullName}</span>
                  )}
                </div>
                {(event.fromStatus || event.toStatus) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {event.fromStatus && <SampleStatusBadge status={event.fromStatus} />}
                    {event.fromStatus && event.toStatus && (
                      <Icon name="chevron-right" size="xs" className="text-fg-subtle" />
                    )}
                    {event.toStatus && <SampleStatusBadge status={event.toStatus} />}
                  </div>
                )}
                {event.reason && (
                  <p className="mt-2 rounded-lg border border-warning-line bg-warning-subtle px-3 py-2 text-xs text-fg">
                    <span className="font-medium text-warning-fg">
                      {t('samples.reason', 'Sabab')}:
                    </span>{' '}
                    {event.reason}
                  </p>
                )}
              </div>
              <time
                dateTime={event.createdAt}
                className="shrink-0 text-xs text-fg-subtle tabular-nums"
              >
                {formatDateTime(event.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
