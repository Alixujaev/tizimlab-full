import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { cx } from '../../lib/cx';
import { Modal } from '../Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Qo'shimcha kontent (masalan, sabab maydoni). */
  children?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** `danger` — qaytarib bo'lmaydigan amallar (o'chirish, to'xtatish). */
  tone?: 'danger' | 'primary';
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** `window.confirm()` o'rniga: role=alertdialog, fokus "Bekor qilish" da (xavfsiz tanlov). */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onCancel}
      role="alertdialog"
      size="sm"
      initialFocus={children ? undefined : cancelRef}
      title={
        <span className="flex items-center gap-2.5">
          <span
            className={cx(
              'flex size-8 items-center justify-center rounded-full',
              tone === 'danger'
                ? 'bg-danger-subtle text-danger-fg'
                : 'bg-primary-subtle text-primary-subtle-fg',
            )}
          >
            <Icon name={tone === 'danger' ? 'alert-triangle' : 'info'} size="sm" />
          </span>
          {title}
        </span>
      }
      description={description}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t('ui.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('ui.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
