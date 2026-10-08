import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import { Spinner } from '@/components/ui/Spinner';
import { useChangePasswordMutation, useUpdateProfileMutation } from '@/hooks/useProfile';
import { LANGUAGE_STORAGE_KEY } from '@/i18n';
import { isPasswordValid } from '@/lib/validation';
import { useAuthStore } from '@/store/authStore';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();

  // Full name state
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user?.fullName]);

  const handleUpdateName = (e: FormEvent) => {
    e.preventDefault();
    setNameError(undefined);
    setNameSuccess(false);

    const trimmed = fullName.trim();
    if (!trimmed) {
      setNameError(t('profile.errors.nameRequired'));
      return;
    }

    updateProfileMutation.mutate(
      { fullName: trimmed },
      {
        onSuccess: () => {
          setNameSuccess(true);
          setTimeout(() => setNameSuccess(false), 3000);
        },
        onError: (err) => {
          const apiError = toApiError(err);
          setNameError(apiError?.message ?? t('errors.generic'));
        },
      },
    );
  };

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(undefined);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError(t('auth.validation.passwordRequired'));
      return;
    }

    if (!newPassword) {
      setPasswordError(t('users.errors.passwordRequired'));
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t('profile.errors.newPasswordSameAsOld'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.errors.passwordMismatch'));
      return;
    }

    if (!isPasswordValid(newPassword)) {
      setPasswordError(t('users.errors.passwordPolicy'));
      return;
    }

    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordSuccess(true);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setTimeout(() => setPasswordSuccess(false), 4000);
        },
        onError: (err) => {
          const apiError = toApiError(err);
          const msg = apiError?.message?.toLowerCase() ?? '';
          if (msg.includes('joriy parol')) {
            setPasswordError(t('profile.errors.currentPasswordIncorrect'));
          } else if (msg.includes('bir xil')) {
            setPasswordError(t('profile.errors.newPasswordSameAsOld'));
          } else {
            setPasswordError(apiError?.message ?? t('errors.generic'));
          }
        },
      },
    );
  };

  const handleLanguageChange = (lang: string) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('profile.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('profile.subtitle')}</p>
      </div>

      {/* Account Info */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t('profile.accountInfo')}</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('profile.email')}
            </span>
            <p className="mt-1 text-sm font-medium text-slate-900">{user.email}</p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('profile.role')}
            </span>
            <p className="mt-1">
              <span className="inline-flex items-center rounded bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                {t(`users.roles.${user.role}`)}
              </span>
            </p>
          </div>

          <div className="sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('profile.company')}
            </span>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {user.company ? user.company.name : t('profile.platformAdmin')}
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="mt-6 border-t border-slate-200 pt-6">
          {nameSuccess && (
            <div role="status" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              {t('profile.nameUpdated')}
            </div>
          )}

          <div>
            <label htmlFor="profile-full-name" className="block text-sm font-medium text-slate-700">
              {t('profile.fullName')}
            </label>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <input
                id="profile-full-name"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setNameError(undefined);
                }}
                disabled={updateProfileMutation.isPending}
                className="block w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {updateProfileMutation.isPending && <Spinner size="sm" />}
                {t('profile.updateName')}
              </button>
            </div>
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t('profile.changePassword')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('profile.changePasswordHint')}</p>

        {passwordSuccess && (
          <div role="status" className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            {t('profile.passwordChanged')}
          </div>
        )}

        {passwordError && (
          <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-4 max-w-md space-y-4" noValidate>
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
              {t('profile.currentPassword')}
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError(undefined);
              }}
              disabled={changePasswordMutation.isPending}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              {t('profile.newPassword')}
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(undefined);
              }}
              disabled={changePasswordMutation.isPending}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-slate-700">
              {t('profile.confirmNewPassword')}
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(undefined);
              }}
              disabled={changePasswordMutation.isPending}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {changePasswordMutation.isPending && <Spinner size="sm" />}
            {changePasswordMutation.isPending
              ? t('profile.submittingPassword')
              : t('profile.submitPassword')}
          </button>
        </form>
      </div>

      {/* Language Selector */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t('profile.language')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('profile.languageHint')}</p>

        <div className="mt-4 max-w-xs">
          <select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            aria-label={t('profile.language')}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="uz">{t('languages.uz')}</option>
            <option value="ru">{t('languages.ru')}</option>
            <option value="en">{t('languages.en')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
