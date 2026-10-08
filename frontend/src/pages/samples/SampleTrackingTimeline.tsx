import React from 'react';
import { useTranslation } from 'react-i18next';
import { SampleStatusBadge } from './SampleStatusBadge';
import type { SampleTrackingDto, SampleTrackingEventType } from '@/types';

interface SampleTrackingTimelineProps {
  tracking: SampleTrackingDto[];
}

export const SampleTrackingTimeline: React.FC<SampleTrackingTimelineProps> = ({ tracking }) => {
  const { t } = useTranslation();

  const getEventTitle = (eventType: SampleTrackingEventType) => {
    return t(`samples.events.${eventType}`, eventType);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  if (!tracking || tracking.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
        {t('samples.noTrackingEvents', "Hozircha harakatlar tarixi mavjud emas")}
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {tracking.map((event, eventIdx) => {
          const isLast = eventIdx === tracking.length - 1;
          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3 items-start">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center ring-8 ring-white text-xs font-bold">
                      {tracking.length - eventIdx}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {getEventTitle(event.eventType)}
                        </span>
                        {event.userFullName && (
                          <span className="text-xs text-slate-500">
                            ({event.userFullName})
                          </span>
                        )}
                      </div>

                      {(event.fromStatus || event.toStatus) && (
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          {event.fromStatus && (
                            <SampleStatusBadge status={event.fromStatus} />
                          )}
                          {event.fromStatus && event.toStatus && (
                            <span className="text-slate-400">→</span>
                          )}
                          {event.toStatus && (
                            <SampleStatusBadge status={event.toStatus} />
                          )}
                        </div>
                      )}

                      {event.reason && (
                        <p className="mt-2 text-xs text-slate-700 bg-amber-50 p-2 rounded border border-amber-200">
                          <span className="font-medium text-amber-900">
                            {t('samples.reason', 'Sabab')}:
                          </span>{' '}
                          {event.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs whitespace-nowrap text-slate-400">
                      <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
