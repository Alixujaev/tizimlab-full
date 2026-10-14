import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '../../atoms/Icon';
import { cx } from '../../lib/cx';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** O'ng tomondagi asosiy amallar (Button'lar). */
  actions?: ReactNode;
  /** Sarlavha yonidagi holat/belgi (StatusPill, Badge). */
  meta?: ReactNode;
  /** Orqaga havola (tafsilot sahifalari). */
  back?: { to: string; label?: ReactNode };
  className?: string;
}

/** Har sahifaning yagona sarlavhasi: h1, tavsif, amallar; mobil'da amallar pastga tushadi. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  back,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className={cx('flex flex-col gap-3', className)}>
      {back && (
        <Link
          to={back.to}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-fg-muted transition-colors motion-fast focus-ring hover:text-fg"
        >
          <Icon name="arrow-left" size="sm" />
          {back.label ?? t('ui.back')}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            {meta}
          </div>
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
    </header>
  );
}
