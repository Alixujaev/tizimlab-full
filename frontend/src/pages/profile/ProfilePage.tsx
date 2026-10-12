import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import type { TelegramLinkToken } from '@/api/telegram';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useChangePasswordMutation, useUpdateProfileMutation } from '@/hooks/useProfile';
import {
  useCreateTelegramLinkTokenMutation,
  useTelegramStatusQuery,
  useUnlinkTelegramMutation,
} from '@/hooks/useTelegram';
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

  // Telegram state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTokenData, setLinkTokenData] = useState<TelegramLinkToken | null>(null);
  const [telegramFeedback, setTelegramFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  const telegramStatusQuery = useTelegramStatusQuery();
  const createLinkTokenMutation = useCreateTelegramLinkTokenMutation();
  const unlinkTelegramMutation = useUnlinkTelegramMutation();

  const handleCreateLinkToken = () => {
    setTelegramFeedback(null);
    createLinkTokenMutation.mutate(undefined, {
      onSuccess: (data) => {
        setLinkTokenData(data);
        setLinkModalOpen(true);
      },
      onError: (err) => {
        const apiErr = toApiError(err);
        setTelegramFeedback({
          type: 'error',
          message: apiErr?.message ?? t('errors.generic'),
        });
      },
    });
  };

  const handleUnlink = () => {
    setTelegramFeedback(null);
    unlinkTelegramMutation.mutate(undefined, {
      onSuccess: () => {
        setUnlinkConfirmOpen(false);
        setTelegramFeedback({
          type: 'success',
          message: t('profile.telegram.unlinkSuccess'),
        });
        setTimeout(() => setTelegramFeedback(null), 4000);
      },
      onError: (err) => {
        const apiErr = toApiError(err);
        setTelegramFeedback({
          type: 'error',
          message: apiErr?.message ?? t('errors.generic'),
        });
      },
    });
  };

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

      {/* Telegram Integration */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('profile.telegram.title')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('profile.telegram.subtitle')}</p>
          </div>
          {telegramStatusQuery.data?.linked ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {t('profile.telegram.linked')}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {t('profile.telegram.notLinked')}
            </span>
          )}
        </div>

        {telegramFeedback && (
          <div
            role={telegramFeedback.type === 'error' ? 'alert' : 'status'}
            className={`mt-4 rounded-md p-3 text-sm ${
              telegramFeedback.type === 'error'
                ? 'bg-red-50 text-red-700'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {telegramFeedback.message}
          </div>
        )}

        {telegramStatusQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Spinner size="sm" />
            <span>{t('common.loading')}</span>
          </div>
        ) : telegramStatusQuery.data?.linked ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {telegramStatusQuery.data.telegramUsername && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {t('profile.telegram.username')}
                  </span>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    @{telegramStatusQuery.data.telegramUsername}
                  </p>
                </div>
              )}
              {telegramStatusQuery.data.linkedAt && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {t('profile.telegram.linkedAt')}
                  </span>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {new Date(telegramStatusQuery.data.linkedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setUnlinkConfirmOpen(true)}
                disabled={unlinkTelegramMutation.isPending}
                className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {unlinkTelegramMutation.isPending && <Spinner size="sm" />}
                {t('profile.telegram.unlinkButton')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleCreateLinkToken}
              disabled={createLinkTokenMutation.isPending}
              className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            >
              {createLinkTokenMutation.isPending && <Spinner size="sm" />}
              {createLinkTokenMutation.isPending
                ? t('profile.telegram.generatingLink')
                : t('profile.telegram.linkButton')}
            </button>
          </div>
        )}
      </div>

      {/* Telegram Link Modal */}
      {linkModalOpen && linkTokenData && (
        <Modal
          open={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          title={t('profile.telegram.linkModalTitle')}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('profile.telegram.linkModalInstruction')}
            </p>

            {linkTokenData.linkUrl ? (
              <div className="flex flex-col gap-2">
                <a
                  href={linkTokenData.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
                >
                  {t('profile.telegram.openBotButton')}
                </a>
                <p className="text-xs text-slate-400">
                  {t('profile.telegram.tokenExpires')}
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                <code>{t('profile.telegram.startCommand')} {linkTokenData.token}</code>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Unlink Confirmation Modal */}
      {unlinkConfirmOpen && (
        <Modal
          open={unlinkConfirmOpen}
          onClose={() => setUnlinkConfirmOpen(false)}
          title={t('profile.telegram.unlinkButton')}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnlinkConfirmOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('profile.telegram.close')}
              </button>
              <button
                type="button"
                onClick={handleUnlink}
                disabled={unlinkTelegramMutation.isPending}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {unlinkTelegramMutation.isPending && <Spinner size="sm" />}
                {t('profile.telegram.unlinkButton')}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-600">{t('profile.telegram.unlinkConfirm')}</p>
        </Modal>
      )}

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
