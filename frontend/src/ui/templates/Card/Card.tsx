import { type ReactNode, useId } from 'react';
import { cx } from '../../lib/cx';

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Sarlavha o'ng tomonidagi amallar. */
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Ichki chetlarsiz (jadval, ro'yxat to'g'ridan joylashsa). */
  flush?: boolean;
  className?: string;
}

/** Mazmun bloki (tafsilot bo'limlari, formalar): sarlavha — `section` nomi sifatida. */
export function Card({
  title,
  description,
  actions,
  children,
  footer,
  flush = false,
  className,
}: CardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cx(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-sm',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-base font-semibold text-fg">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? undefined : 'px-5 py-4'}>{children}</div>
      {footer && <div className="border-t border-line bg-surface-muted px-5 py-3">{footer}</div>}
    </section>
  );
}
