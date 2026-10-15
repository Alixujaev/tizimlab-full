import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { toApiError } from '@/api/client';
import { AppSkeleton } from '@/components/layout/AppSkeleton';
import { BrandMark } from '@/components/layout/BrandMark';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { isTelegramWebApp } from '@/lib/telegram';
import { Alert, Button, FormField, IconButton, Input } from '@/ui';

// Server xato kodlari → tarjima kalitlari (qolganlari umumiy xabar)
const KNOWN_ERRORS = ['INVALID_CREDENTIALS', 'ACCOUNT_INACTIVE', 'RATE_LIMITED'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

/** `ProtectedRoute` saqlagan qaytish manzili (bo'lmasa — bosh sahifa; super_admin uchun HomePage yo'naltiradi, D-28). */
function redirectTarget(state: unknown): string {
  const from = (state as { from?: { pathname?: string } } | null)?.from?.pathname;
  return from && from !== '/login' ? from : '/';
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const loginMutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (isTelegramWebApp() && status !== 'authenticated') {
    return <Navigate to="/" replace />;
  }
  if (status === 'unknown') return <AppSkeleton variant="auth" />;
  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />;

  const serverError = (() => {
    if (!loginMutation.error) return null;
    const code = toApiError(loginMutation.error)?.code;
    return KNOWN_ERRORS.includes(code as (typeof KNOWN_ERRORS)[number])
      ? t(`auth.errors.${code}`)
      : t('errors.generic');
  })();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const trimmed = email.trim();
    if (!trimmed) errors.email = t('auth.validation.emailRequired');
    else if (!EMAIL_RE.test(trimmed)) errors.email = t('auth.validation.emailInvalid');
    if (!password) errors.password = t('auth.validation.passwordRequired');
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    loginMutation.mutate(
      { email: trimmed, password },
      { onSuccess: () => void navigate(redirectTarget(location.state), { replace: true }) },
    );
  };

  const pending = loginMutation.isPending;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-modal-sm animate-slide-up flex-col items-center gap-8">
        <BrandMark large />
        <section className="w-full rounded-2xl border border-line bg-surface p-6 shadow-md sm:p-8">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-fg">{t('pages.login')}</h1>
            <p className="text-sm text-fg-muted">{t('auth.welcome')}</p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <FormField label={t('auth.email')} error={fieldErrors.email} disabled={pending}>
              <Input
                type="email"
                autoComplete="username"
                inputMode="email"
                leftIcon="user"
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <FormField label={t('auth.password')} error={fieldErrors.password} disabled={pending}>
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                size="lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                rightSlot={
                  <IconButton
                    icon={showPassword ? 'eye-off' : 'eye'}
                    label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    size="sm"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  />
                }
              />
            </FormField>
            {serverError && <Alert tone="danger">{serverError}</Alert>}
            <Button type="submit" size="lg" fullWidth loading={pending} className="mt-2">
              {pending ? t('auth.submitting') : t('auth.submit')}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
