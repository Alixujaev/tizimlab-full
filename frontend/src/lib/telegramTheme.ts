/**
 * Telegram themeParams bilan TizimLab dizayn tokenlarini sinxronlashtirish (P14, D-166).
 * Kontrast WCAG AA (>= 4.5:1) saqlanadi, qorong'i/yorug' rejim avtomatik boshqariladi.
 */

import { applyTheme, useThemeStore } from '@/store/themeStore';
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
 * Qoida: foydalanuvchi tanlovi (qo'lda tema almashtirgich, saqlangan) ustuvor;
 * tanlov yo'q bo'lsa Telegram colorScheme'ga ergash.
 * themeParams faqat tanlangan tema ichida accent (button, link) ranglarini moslasin,
 * fon/matn/surface tokenlarini butunlay ustiga yozmasin.
 */
export function syncTelegramTheme(): void {
  if (!isTelegramWebApp()) return;
  const tg = getTelegramWebApp();
  if (!tg) return;

  // 1) Foydalanuvchi tanlovi ustuvor; tanlov yo'q ('system') bo'lsa Telegram colorScheme
  const userPref = useThemeStore.getState().preference;
  if (userPref === 'system') {
    applyTheme(tg.colorScheme || 'light');
  } else {
    applyTheme(userPref);
  }

  // 2) Fon/matn/surface tokenlarini butunlay ustiga yozmaslik (tozalash)
  const root = document.documentElement;
  root.style.removeProperty('--tl-surface');
  root.style.removeProperty('--tl-canvas');
  root.style.removeProperty('--tl-fg');
  root.style.removeProperty('--tl-surface-muted');

  const params = tg.themeParams || {};

  // 3) Faqat accent (button, link) ranglarini moslash (WCAG AA >= 4.5)
  if (params.button_color && params.button_text_color) {
    const btnContrast = getContrastRatio(params.button_text_color, params.button_color);
    if (btnContrast >= 4.5) {
      root.style.setProperty('--tl-primary', params.button_color);
      root.style.setProperty('--tl-primary-fg', params.button_text_color);
    }
  }

  if (params.link_color) {
    root.style.setProperty('--tl-accent', params.link_color);
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
