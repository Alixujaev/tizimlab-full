import { type ReactNode, type RefObject, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../atoms/IconButton';
import { cx } from '../../lib/cx';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { useScrollLock } from '../../lib/useScrollLock';

const sizes = {
  sm: 'max-w-modal-sm',
  md: 'max-w-modal-md',
  lg: 'max-w-modal-lg',
  xl: 'max-w-modal-xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizes;
  /** `alertdialog` — tasdiqlash so'rovlari uchun (ConfirmDialog). */
  role?: 'dialog' | 'alertdialog';
  initialFocus?: RefObject<HTMLElement | null>;
  /** Fon bosilganda yopilsinmi (standart — ha). */
  closeOnOverlay?: boolean;
}

/**
 * Dialog oynasi: role=dialog, aria-modal, sarlavha/tavsif bog'langan, focus trap, Esc,
 * yopilganda fokus ochgan elementga qaytadi, fon scroll'i to'xtaydi.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  initialFocus,
  closeOnOverlay = true,
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, { active: open, onEscape: onClose, initialFocus });
  useScrollLock(open);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center p-2 sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-overlay"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-full w-full animate-scale-in flex-col rounded-2xl border border-line bg-surface text-fg shadow-xl outline-none',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton
            icon="x"
            label={t('common.close')}
            size="sm"
            onClick={onClose}
            className="-mr-1"
          />
        </div>
        {children !== undefined && <div className="overflow-y-auto px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
