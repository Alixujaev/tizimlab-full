/**
 * Telegram themeParams bilan TizimLab dizayn tokenlarini sinxronlashtirish (P14, D-166).
 * Kontrast WCAG AA (>= 4.5:1) saqlanadi, qorong'i/yorug' rejim avtomatik boshqariladi.
 */

import { applyTheme } from '@/store/themeStore';
import { getTelegramWebApp, isTelegramWebApp } from './telegram';

/** Hex rangdan nisbiy yorqinlik (relative luminance) hisoblash (WCAG 2.1) */
export function getLuminance(hex: string): number {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6 && clean.length !== 3) return 0.5;

  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const adjust = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

/** Ikki rang orasidagi WCAG kontrast nisbati (1..21) */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Telegram themeParams ni tekshirib, CSS tokenlariga qo'llash.
 * Kontrast yetarli bo'lmasa (WCAG AA < 4.5), dizayn tizimining standart tokenlari saqlanadi.
 */
export function syncTelegramTheme(): void {
  if (!isTelegramWebApp()) return;
  const tg = getTelegramWebApp();
  if (!tg) return;

  // 1) Qorong'i / yorug' rejimni sinxronlashtirish
  const scheme = tg.colorScheme || 'light';
  applyTheme(scheme);

  // 2) Telegram themeParams ni o'qish
  const params = tg.themeParams || {};
  const root = document.documentElement;

  // Agar Telegram ranglari berilgan bo'lsa va kontrast yetarli bo'lsa:
  if (params.bg_color && params.text_color) {
    const textContrast = getContrastRatio(params.text_color, params.bg_color);
    if (textContrast >= 4.5) {
      root.style.setProperty('--tl-surface', params.bg_color);
      root.style.setProperty('--tl-fg', params.text_color);
      if (params.secondary_bg_color) {
        root.style.setProperty('--tl-canvas', params.secondary_bg_color);
        root.style.setProperty('--tl-surface-muted', params.secondary_bg_color);
      }
    }
  }

  if (params.hint_color && params.bg_color) {
    const hintContrast = getContrastRatio(params.hint_color, params.bg_color);
    if (hintContrast >= 3.0) {
      root.style.setProperty('--tl-fg-muted', params.hint_color);
    }
  }

  if (params.button_color && params.button_text_color) {
    const btnContrast = getContrastRatio(params.button_text_color, params.button_color);
    if (btnContrast >= 4.5) {
      root.style.setProperty('--tl-primary', params.button_color);
      root.style.setProperty('--tl-primary-fg', params.button_text_color);
    }
  }
}

/**
 * Telegram theme o'zgarishini kuzatish va tozalash funksiyasini qaytarish.
 */
export function setupTelegramThemeListener(): () => void {
  if (!isTelegramWebApp()) return () => {};
  const tg = getTelegramWebApp();
  if (!tg) return () => {};

  syncTelegramTheme();

  const handleThemeChange = () => {
    syncTelegramTheme();
  };

  try {
    tg.onEvent('themeChanged', handleThemeChange);
  } catch {
    // jimgina fallback
  }

  return () => {
    try {
      tg.offEvent('themeChanged', handleThemeChange);
    } catch {
      // jimgina fallback
    }
  };
}
