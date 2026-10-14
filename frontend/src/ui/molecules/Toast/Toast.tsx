import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type ExternalToast, Toaster as SonnerToaster, toast } from 'sonner';
import { Icon } from '../../atoms/Icon';
import { Spinner } from '../../atoms/Spinner';

/**
 * Global xabarnomalar (D-155): sonner — faqat dvigatel (navbat, taymer, aria-live), ko'rinish — tokenlardan
 * (`unstyled`). Sahifalar `alert()` yoki sonner o'rniga `notify` dan foydalanadi.
 */
export const notify = {
  success: (message: ReactNode, opts?: ExternalToast) => toast.success(message, opts),
  error: (message: ReactNode, opts?: ExternalToast) => toast.error(message, opts),
  warning: (message: ReactNode, opts?: ExternalToast) => toast.warning(message, opts),
  info: (message: ReactNode, opts?: ExternalToast) => toast.info(message, opts),
  dismiss: (id?: string | number) => toast.dismiss(id),
};

const toneIcon = 'mt-0.5';

export function Toaster() {
  const { t } = useTranslation();
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      containerAriaLabel={t('ui.toast.region')}
      className="z-toast"
      icons={{
        success: <Icon name="check-circle" size="md" className={`${toneIcon} text-success`} />,
        error: <Icon name="x-circle" size="md" className={`${toneIcon} text-danger`} />,
        warning: <Icon name="alert-triangle" size="md" className={`${toneIcon} text-warning`} />,
        info: <Icon name="info" size="md" className={`${toneIcon} text-info`} />,
        loading: <Spinner inline size="sm" />,
        close: <Icon name="x" size="xs" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t('ui.toast.dismiss'),
        classNames: {
          toast:
            'group pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 pr-9 text-sm text-fg shadow-lg',
          title: 'font-medium leading-5',
          description: 'mt-0.5 text-fg-muted',
          content: 'flex min-w-0 flex-1 flex-col',
          icon: 'flex shrink-0',
          closeButton:
            'absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-fg-subtle transition-colors motion-fast focus-ring hover:bg-surface-sunken hover:text-fg',
          actionButton:
            'rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-fg hover:bg-primary-hover',
          cancelButton:
            'rounded-md px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-sunken',
          success: 'border-success-line',
          error: 'border-danger-line',
          warning: 'border-warning-line',
          info: 'border-info-line',
        },
      }}
    />
  );
}
