import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState } from '@/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** O'zgarganda (masalan, boshqa sahifaga o'tilganda) xato holati tozalanadi. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Sahifa render xatosi butun ilovani yiqitmasin: qobiq (menyu) qoladi, mazmun o'rnida ErrorState. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI render xatosi', error, info.componentStack);
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render(): ReactNode {
    if (this.state.error) return <ErrorFallback onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

export function ErrorFallback({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2">
      <ErrorState
        title={t('errors.boundaryTitle')}
        description={t('errors.boundaryText')}
        onRetry={onRetry}
      />
      <Button variant="ghost" size="sm" leftIcon="refresh" onClick={() => window.location.reload()}>
        {t('errors.reload')}
      </Button>
    </div>
  );
}

/** Router `errorElement`: qobiqdan tashqaridagi (layout, loader) xatolar uchun to'liq sahifa. */
export function RouteErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <ErrorFallback />
    </main>
  );
}
