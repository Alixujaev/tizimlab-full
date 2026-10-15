import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { telegramHaptic, telegramOpenLink } from '@/lib/telegram';
import { Alert, Button, Card, FileButton, Icon } from '@/ui';

export const MAX_MOBILE_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (D-06)
export const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

export interface MobileFileUploadProps {
  onUpload: (file: File) => Promise<{ url?: string; fileId?: string }>;
  uploadedUrl?: string | null;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Telegram WebApp uchun mobil fayl yuklash komponenti (P14, D-166).
 * Kamera / Galereya / Fayl tanlash, 20MB va ruxsat etilgan formatlar tekshiruvi,
 * yuklash jarayoni va yuklangan faylni ochish uchun Telegram.openLink.
 */
export function MobileFileUpload({
  onUpload,
  uploadedUrl,
  onSuccess,
  className,
}: MobileFileUploadProps) {
  const { t } = useTranslation();

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(uploadedUrl ?? null);

  const validateFile = (file: File): string | null => {
    // 1) Hajm tekshiruvi (20MB)
    if (file.size > MAX_MOBILE_FILE_BYTES) {
      return t(
        'files.errors.sizeTooLarge',
        "Fayl hajmi 20MB dan oshmasligi kerak",
      );
    }

    // 2) Format tekshiruvi
    const nameLower = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
    const hasValidMime = file.type ? ALLOWED_MIME_TYPES.includes(file.type) : true;

    if (!hasValidExt && !hasValidMime) {
      return t(
        'files.errors.invalidFormat',
        'Faqat PDF, DOC, DOCX, JPEG, PNG formatlariga ruxsat berilgan',
      );
    }

    return null;
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      telegramHaptic('notification', 'error');
      setError(validationError);
      return;
    }

    setUploading(true);
    setProgress(30);

    try {
      const res = await onUpload(file);
      setProgress(100);
      telegramHaptic('notification', 'success');
      if (res.url) {
        setCurrentUrl(res.url);
      }
      onSuccess?.();
    } catch (err: unknown) {
      telegramHaptic('notification', 'error');
      const msg = (err as Error)?.message || t('errors.generic', 'Xatolik yuz berdi');
      setError(msg);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleOpenFile = () => {
    if (currentUrl) {
      telegramOpenLink(currentUrl);
    }
  };

  return (
    <Card className={`p-4 flex flex-col gap-3 ${className ?? ''}`}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-fg">
          {t('files.uploadTitle', 'Fayl yuklash')}
        </h3>
        <p className="text-xs text-fg-muted">
          {t(
            'files.uploadHint',
            'PDF, DOC, DOCX, JPEG, PNG (maksimal 20MB)',
          )}
        </p>
      </div>

      {error && (
        <Alert tone="danger">
          {error}
        </Alert>
      )}

      {uploading && (
        <div className="flex flex-col gap-1.5 py-2">
          <div className="flex justify-between text-xs text-fg-muted">
            <span>{t('common.loading', 'Yuklanmoqda...')}</span>
            {progress !== null && <span>{progress}%</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress ?? 50}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <FileButton
          variant="secondary"
          size="lg"
          leftIcon="flask"
          disabled={uploading}
          capture="environment"
          accept={['image/*']}
          onSelect={(file) => {
            telegramHaptic('impact', 'light');
            void handleFileChange(file);
          }}
          className="flex-1"
        >
          {t('files.camera', 'Kamera')}
        </FileButton>

        <FileButton
          variant="secondary"
          size="lg"
          leftIcon="upload"
          disabled={uploading}
          accept={ALLOWED_EXTENSIONS}
          onSelect={(file) => {
            telegramHaptic('impact', 'light');
            void handleFileChange(file);
          }}
          className="flex-1"
        >
          {t('files.chooseFile', 'Fayl tanlash')}
        </FileButton>
      </div>

      {currentUrl && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-line bg-surface-muted p-2.5">
          <div className="flex items-center gap-2 truncate">
            <Icon name="file-text" size="sm" className="text-primary shrink-0" />
            <span className="truncate text-xs font-medium text-fg">
              {t('files.uploadedSuccess', 'Fayl yuklangan')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs shrink-0"
            onClick={handleOpenFile}
            leftIcon="globe"
          >
            {t('common.open', 'Ochish')}
          </Button>
        </div>
      )}
    </Card>
  );
}
