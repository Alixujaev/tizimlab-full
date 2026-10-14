import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '@/api/client';
import type { TelegramLinkToken } from '@/api/telegram';
import { useChangePasswordMutation, useUpdateProfileMutation } from '@/hooks/useProfile';
import {
  useCreateTelegramLinkTokenMutation,
  useTelegramStatusQuery,
  useUnlinkTelegramMutation,
} from '@/hooks/useTelegram';
import { changeLanguage, LANGUAGES, type Language } from '@/i18n';
import { isPasswordValid } from '@/lib/validation';
import { useAuthStore } from '@/store/authStore';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  buttonBase,
  buttonSizes,
  buttonVariants,
  Card,
  ConfirmDialog,
  cx,
  DescriptionList,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
} from '@/ui';

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
  general?: string;
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});

  const [linkTokenData, setLinkTokenData] = useState<TelegramLinkToken | null>(null);
  const [telegramFeedback, setTelegramFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const telegramStatusQuery = useTelegramStatusQuery();
  const createLinkTokenMutation = useCreateTelegramLinkTokenMutation();
  const unlinkTelegramMutation = useUnlinkTelegramMutation();

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  if (!user) return null;

  const handleCreateLinkToken = () => {
    setTelegramFeedback(null);
    createLinkTokenMutation.mutate(undefined, {
      onSuccess: (data) => setLinkTokenData(data),
      onError: (err) =>
        setTelegramFeedback({
          type: 'error',
          message: toApiError(err)?.message ?? t('errors.generic'),
        }),
    });
  };

  const handleUnlink = () => {
    setTelegramFeedback(null);
    unlinkTelegramMutation.mutate(undefined, {
      onSuccess: () => {
        setUnlinkConfirmOpen(false);
        setTelegramFeedback({ type: 'success', message: t('profile.telegram.unlinkSuccess') });
        setTimeout(() => setTelegramFeedback(null), 4000);
      },
      onError: (err) => {
        setUnlinkConfirmOpen(false);
        setTelegramFeedback({
          type: 'error',
          message: toApiError(err)?.message ?? t('errors.generic'),
        });
      },
    });
  };

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
        onError: (err) => setNameError(toApiError(err)?.message ?? t('errors.generic')),
      },
    );
  };

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(false);
    const fail = (errors: PasswordErrors) => setPasswordErrors(errors);
    if (!currentPassword) return fail({ current: t('auth.validation.passwordRequired') });
    if (!newPassword) return fail({ next: t('users.errors.passwordRequired') });
    if (currentPassword === newPassword)
      return fail({ next: t('profile.errors.newPasswordSameAsOld') });
    if (newPassword !== confirmPassword)
      return fail({ confirm: t('profile.errors.passwordMismatch') });
    if (!isPasswordValid(newPassword)) return fail({ next: t('users.errors.passwordPolicy') });
    setPasswordErrors({});

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
          if (msg.includes('joriy parol'))
            fail({ current: t('profile.errors.currentPasswordIncorrect') });
          else if (msg.includes('bir xil'))
            fail({ next: t('profile.errors.newPasswordSameAsOld') });
          else fail({ general: apiError?.message ?? t('errors.generic') });
        },
      },
    );
  };

  const clearPasswordErrors = () => setPasswordErrors((p) => (Object.keys(p).length ? {} : p));
  const telegram = telegramStatusQuery.data;

  return (
    <>
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t('profile.accountInfo')} className="lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar name={user.fullName} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <DescriptionList
                columns={3}
                items={[
                  { label: t('profile.email'), value: user.email },
                  {
                    label: t('profile.role'),
                    value: <Badge tone="primary">{t(`users.roles.${user.role}`)}</Badge>,
                  },
                  {
                    label: t('profile.company'),
                    value: user.company ? user.company.name : t('profile.platformAdmin'),
                  },
                ]}
              />
              <form
                onSubmit={handleUpdateName}
                noValidate
                className="flex flex-col gap-3 border-t border-line pt-5"
              >
                {nameSuccess && <Alert tone="success">{t('profile.nameUpdated')}</Alert>}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <FormField
                    id="profile-full-name"
                    label={t('profile.fullName')}
                    error={nameError}
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 sm:max-w-md"
                  >
                    <Input
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setNameError(undefined);
                      }}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    loading={updateProfileMutation.isPending}
                    className={nameError ? 'sm:mb-6' : undefined}
                  >
                    {t('profile.updateName')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Card>

        <Card title={t('profile.changePassword')} description={t('profile.changePasswordHint')}>
          <form onSubmit={handleChangePassword} noValidate className="flex flex-col gap-4">
            {passwordSuccess && <Alert tone="success">{t('profile.passwordChanged')}</Alert>}
            {passwordErrors.general && <Alert tone="danger">{passwordErrors.general}</Alert>}
            <FormField
              id="current-password"
              label={t('profile.currentPassword')}
              error={passwordErrors.current}
              disabled={changePasswordMutation.isPending}
            >
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  clearPasswordErrors();
                }}
              />
            </FormField>
            <FormField
              id="new-password"
              label={t('profile.newPassword')}
              error={passwordErrors.next}
              disabled={changePasswordMutation.isPending}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clearPasswordErrors();
                }}
              />
            </FormField>
            <FormField
              id="confirm-new-password"
              label={t('profile.confirmNewPassword')}
              error={passwordErrors.confirm}
              disabled={changePasswordMutation.isPending}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearPasswordErrors();
                }}
              />
            </FormField>
            <div>
              <Button type="submit" loading={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending
                  ? t('profile.submittingPassword')
                  : t('profile.submitPassword')}
              </Button>
            </div>
          </form>
        </Card>

        <div className="flex flex-col gap-6">
          <Card
            title={t('profile.telegram.title')}
            description={t('profile.telegram.subtitle')}
            actions={
              telegram?.linked ? (
                <StatusPill tone="success">{t('profile.telegram.linked')}</StatusPill>
              ) : (
                <StatusPill tone="neutral">{t('profile.telegram.notLinked')}</StatusPill>
              )
            }
          >
            <div className="flex flex-col gap-4">
              {telegramFeedback && (
                <Alert tone={telegramFeedback.type === 'error' ? 'danger' : 'success'}>
                  {telegramFeedback.message}
                </Alert>
              )}
              {telegramStatusQuery.isLoading ? (
                <div role="status">
                  <span className="sr-only">{t('common.loading')}</span>
                  <Skeleton lines={2} />
                </div>
              ) : telegram?.linked ? (
                <>
                  <DescriptionList
                    items={[
                      telegram.telegramUsername
                        ? {
                            label: t('profile.telegram.username'),
                            value: `@${telegram.telegramUsername}`,
                          }
                        : null,
                      telegram.linkedAt
                        ? {
                            label: t('profile.telegram.linkedAt'),
                            value: new Date(telegram.linkedAt).toLocaleDateString(),
                          }
                        : null,
                    ]}
                  />
                  <div>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      loading={unlinkTelegramMutation.isPending}
                      onClick={() => setUnlinkConfirmOpen(true)}
                    >
                      {t('profile.telegram.unlinkButton')}
                    </Button>
                  </div>
                </>
              ) : (
                <div>
                  <Button
                    leftIcon="send"
                    loading={createLinkTokenMutation.isPending}
                    onClick={handleCreateLinkToken}
                  >
                    {createLinkTokenMutation.isPending
                      ? t('profile.telegram.generatingLink')
                      : t('profile.telegram.linkButton')}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <FormField label={t('profile.language')} hint={t('profile.languageHint')}>
              <Select
                className="max-w-xs"
                options={LANGUAGES.map((lng) => ({ value: lng, label: t(`languages.${lng}`) }))}
                value={i18n.language as Language}
                onChange={(lng) => void changeLanguage(lng)}
              />
            </FormField>
          </Card>
        </div>
      </div>

      <Modal
        open={!!linkTokenData}
        onClose={() => setLinkTokenData(null)}
        title={t('profile.telegram.linkModalTitle')}
        description={t('profile.telegram.linkModalInstruction')}
      >
        {linkTokenData?.linkUrl ? (
          <div className="flex flex-col gap-2">
            <a
              href={linkTokenData.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(buttonBase, buttonVariants.primary, buttonSizes.lg, 'w-full')}
            >
              {t('profile.telegram.openBotButton')}
            </a>
            <p className="text-xs text-fg-muted">{t('profile.telegram.tokenExpires')}</p>
          </div>
        ) : (
          linkTokenData && (
            <code className="block rounded-lg border border-line bg-surface-sunken px-3 py-2 font-mono text-sm text-fg">
              {t('profile.telegram.startCommand')} {linkTokenData.token}
            </code>
          )
        )}
      </Modal>

      <ConfirmDialog
        open={unlinkConfirmOpen}
        title={t('profile.telegram.unlinkButton')}
        description={t('profile.telegram.unlinkConfirm')}
        confirmLabel={t('profile.telegram.unlinkButton')}
        cancelLabel={t('profile.telegram.close')}
        loading={unlinkTelegramMutation.isPending}
        onConfirm={handleUnlink}
        onCancel={() => setUnlinkConfirmOpen(false)}
      />
    </>
  );
}
