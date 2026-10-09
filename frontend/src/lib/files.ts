// Mijoz tomonidagi oldindan tekshiruv — faqat qulaylik uchun; haqiqiy tekshiruv backend'da (magic bytes, D-114).

/** Namuna pasporti limiti — 20MB (D-115). */
export const PASSPORT_MAX_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] as const;
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

export type FileCheckError = 'empty' | 'tooLarge' | 'unsupported';

export function checkFile(file: File, maxBytes = PASSPORT_MAX_BYTES): FileCheckError | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return 'unsupported';
  if (file.size === 0) return 'empty';
  if (file.size > maxBytes) return 'tooLarge';
  return null;
}

/** Imzolangan URL'ni yangi oynada ochadi (brauzer Content-Disposition bo'yicha yuklab oladi). */
export function openDownload(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
