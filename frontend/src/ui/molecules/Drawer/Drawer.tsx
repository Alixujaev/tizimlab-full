import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../atoms/IconButton';
import { cx } from '../../lib/cx';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { useScrollLock } from '../../lib/useScrollLock';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right' | 'bottom';
  /** Sarlavha faqat ekran o'quvchilar uchun (masalan, mobil navigatsiya). */
  hideTitle?: boolean;
}

/** Yon panel va mobil bottom-sheet (mobil navigatsiya, filtrlar, tafsilot): Modal bilan bir xil a11y kafolatlari. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  hideTitle = false,
}: DrawerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, { active: open, onEscape: onClose });
  useScrollLock(open);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-drawer">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-overlay"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'absolute flex flex-col bg-surface text-fg shadow-xl outline-none',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t border-line animate-slide-up w-full pb-[env(safe-area-inset-bottom,0px)]'
            : cx(
                'inset-y-0 w-drawer',
                side === 'right'
                  ? 'right-0 animate-slide-in-right border-l border-line'
                  : 'left-0 animate-slide-in-left border-r border-line',
              ),
        )}
      >
        {side === 'bottom' && (
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
        )}
        <div
          className={cx(
            'flex items-center justify-between gap-3 border-b border-line px-4 py-3',
            hideTitle && 'justify-end',
          )}
        >
          <h2 id={titleId} className={cx('text-base font-semibold', hideTitle && 'sr-only')}>
            {title}
          </h2>
          <IconButton icon="x" label={t('common.close')} size="sm" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
