import { useEffect } from 'react';
import { bindTelegramMainButton, isTelegramWebApp } from '@/lib/telegram';

export interface TelegramMainButtonOptions {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isActive?: boolean;
  isProgress?: boolean;
  color?: string;
  textColor?: string;
}

/**
 * Telegram native MainButton hook'i (P14, D-166).
 * Sahifa / forma mount bo'lganda asosiy amal tugmasini ulaydi,
 * unmount da tozalanadi va yashiriladi.
 */
export function useTelegramMainButton({
  text,
  onClick,
  isVisible = true,
  isActive = true,
  isProgress = false,
  color,
  textColor,
}: TelegramMainButtonOptions): void {
  useEffect(() => {
    if (!isTelegramWebApp()) return;

    return bindTelegramMainButton({
      text,
      onClick,
      isVisible,
      isActive,
      isProgress,
      color,
      textColor,
    });
  }, [text, onClick, isVisible, isActive, isProgress, color, textColor]);
}
