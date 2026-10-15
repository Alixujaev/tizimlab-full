import { useTranslation } from 'react-i18next';
import { AppSkeleton } from '@/components/layout/AppSkeleton';
import { BrandMark } from '@/components/layout/BrandMark';
import type { TelegramAuthState } from '@/hooks/useTelegramAuth';
import { telegramOpenLink } from '@/lib/telegram';
import { Button, Card, Icon } from '@/ui';

interface TelegramAuthScreenProps {
  state: TelegramAuthState;
  errorMessage?: string | null;
  onRetry: () => void;
}

/**
 * Telegram WebApp avto-kirish holatlari ekrani (P14, D-166).
 * Bog'lanmagan foydalanuvchi, eskirgan initData, tarmoq xatosi va yuklanish holatlari.
 */
export function TelegramAuthScreen({ state, onRetry }: TelegramAuthScreenProps) {
  const { t } = useTranslation();

  if (state === 'loading' || state === 'idle') {
    return <AppSkeleton />;
  }

  const handleOpenBrowser = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lab.tizimlab.uz';
    telegramOpenLink(`${origin}/profile`);
  };

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-canvas text-fg">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <BrandMark />

        {state === 'unlinked' && (
          <Card className="w-full text-center p-6 flex flex-col items-center gap-4 border-line shadow-md">
            <div className="size-12 rounded-full bg-warning-subtle text-warning-fg flex items-center justify-center">
              <Icon name="alert-circle" size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-semibold text-fg">
                {t('telegram.webapp.unlinkedTitle', "Telegram hisobingiz bog'lanmagan")}
              </h1>
              <p className="text-sm text-fg-muted leading-relaxed">
                {t(
                  'telegram.webapp.unlinkedInstructions',
                  "TizimLab dan foydalanish uchun avval brauzerda tizimga kiring, Profil bo'limiga o'ting va 'Telegram ulash' tugmasi orqali hisobingizni bog'lang.",
                )}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleOpenBrowser}
              leftIcon="globe"
            >
              {t('telegram.webapp.openInBrowser', 'Brauzerda ochish')}
            </Button>
          </Card>
        )}

        {state === 'expired' && (
          <Card className="w-full text-center p-6 flex flex-col items-center gap-4 border-line shadow-md">
            <div className="size-12 rounded-full bg-danger-subtle text-danger-fg flex items-center justify-center">
              <Icon name="clock" size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-semibold text-fg">
                {t('telegram.webapp.expiredTitle', 'Sessiya muddati eskirgan')}
              </h1>
              <p className="text-sm text-fg-muted leading-relaxed">
                {t(
                  'telegram.webapp.expiredInstructions',
                  "Telegram avtorizatsiya ma'lumotlari muddati tugagan yoki allaqachon ishlatilgan. Iltimos, ilovani qayta yuklang.",
                )}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleReload}
              leftIcon="refresh"
            >
              {t('telegram.webapp.reload', 'Qayta yuklash')}
            </Button>
          </Card>
        )}

        {state === 'network_error' && (
          <Card className="w-full text-center p-6 flex flex-col items-center gap-4 border-line shadow-md">
            <div className="size-12 rounded-full bg-danger-subtle text-danger-fg flex items-center justify-center">
              <Icon name="alert-triangle" size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-semibold text-fg">
                {t('telegram.webapp.networkErrorTitle', 'Tarmoq xatosi')}
              </h1>
              <p className="text-sm text-fg-muted leading-relaxed">
                {t(
                  'telegram.webapp.networkErrorInstructions',
                  "Server bilan aloqa o'rnatib bo'lmadi. Internet aloqasini tekshiring va qayta urinib ko'ring.",
                )}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={onRetry}
              leftIcon="refresh"
            >
              {t('common.retry', 'Qayta urinish')}
            </Button>
          </Card>
        )}

        {state === 'logged_out' && (
          <Card className="w-full text-center p-6 flex flex-col items-center gap-4 border-line shadow-md">
            <div className="size-12 rounded-full bg-primary-subtle text-primary flex items-center justify-center">
              <Icon name="log-out" size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-semibold text-fg">
                {t('telegram.webapp.loggedOutTitle', 'Chiqdingiz')}
              </h1>
              <p className="text-sm text-fg-muted leading-relaxed">
                {t(
                  'telegram.webapp.loggedOutInstructions',
                  "Siz hisobingizdan muvaffaqiyatli chiqdingiz. Tizimga qayta kirish uchun quyidagi tugmani bosing.",
                )}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={onRetry}
              leftIcon="log-in"
            >
              {t('telegram.webapp.reLogin', 'Qayta kirish')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
