import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Stub: ro'yxat, o'qilmaganlar soni va Socket.IO yangilanishi P6 da ulanadi (spec §9). */
export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('topbar.notifications')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-lg">
          {t('topbar.noNotifications')}
        </div>
      )}
    </div>
  );
}
