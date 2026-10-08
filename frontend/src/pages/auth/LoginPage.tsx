import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { toApiError } from '@/api/client';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t('pages.login')}</h1>
          <LanguageSwitcher />
        </div>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">
              {t('auth.email')}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              disabled={pending}
            />
            {fieldErrors.email && (
              <p id="login-email-error" className="mt-1 text-sm text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t('auth.password')}
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              disabled={pending}
            />
            {fieldErrors.password && (
              <p id="login-password-error" className="mt-1 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>
          {serverError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={pending}
          >
            {pending ? t('auth.submitting') : t('auth.submit')}
          </button>
        </form>
      </section>
    </main>
  );
}
