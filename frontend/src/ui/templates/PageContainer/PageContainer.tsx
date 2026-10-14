import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/** Sahifa ramkasi: maksimal kenglik, javob beruvchi chetlar, bo'limlar orasida bir xil masofa. */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cx(
        'mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-6 md:px-6 md:py-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
