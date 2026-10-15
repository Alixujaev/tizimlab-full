/**
 * Telegram WebApp TypeScript interfeysi va yordamchi funksiyalari (P14, D-166).
 * Telegram tashqarisida hech qanday xato bermasdan jimgina fallback qiladi.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
}

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => TelegramMainButton;
  onClick: (callback: () => void) => TelegramMainButton;
  offClick: (callback: () => void) => TelegramMainButton;
  show: () => TelegramMainButton;
  hide: () => TelegramMainButton;
  enable: () => TelegramMainButton;
  disable: () => TelegramMainButton;
  showProgress: (leaveActive?: boolean) => TelegramMainButton;
  hideProgress: () => TelegramMainButton;
  setParams: (params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }) => TelegramMainButton;
}

export interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => TelegramHapticFeedback;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => TelegramHapticFeedback;
  selectionChanged: () => TelegramHapticFeedback;
}

export interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: {
      id: number;
      is_bot?: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  HapticFeedback: TelegramHapticFeedback;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;
  isVersionAtLeast: (version: string) => boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  onEvent: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
  offEvent: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  ready: () => void;
  expand: () => void;
  close: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/** WebApp ob'ektini olish (mavjud bo'lmasa null) */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * Haqiqatan Telegram WebApp muhitida ekanligini tekshirish.
 * Oddiy brauzerda telegram-web-app.js bo'lsa ham platform = 'unknown' va initData = '' bo'ladi.
 */
export function isTelegramWebApp(): boolean {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  const hasInitData = typeof tg.initData === 'string' && tg.initData.trim().length > 0;
  const hasKnownPlatform =
    typeof tg.platform === 'string' && tg.platform !== 'unknown' && tg.platform.trim().length > 0;
  return hasInitData || hasKnownPlatform;
}

/** initData qatori (token/sir yo'q, xavfsiz o'qiladi) */
export function getTelegramInitData(): string {
  const tg = getTelegramWebApp();
  return tg?.initData ?? '';
}

/** Foydalanuvchi platformasi (ios, android, tdesktop, macos, web ...) */
export function getTelegramPlatform(): string {
  const tg = getTelegramWebApp();
  return tg?.platform ?? 'unknown';
}

/** Safe area o'lchamlari (notch, pastki chiziq) */
export function getTelegramSafeArea(): TelegramSafeAreaInset {
  const tg = getTelegramWebApp();
  if (!tg) return { top: 0, bottom: 0, left: 0, right: 0 };
  const insets = tg.contentSafeAreaInset || tg.safeAreaInset;
  return {
    top: insets?.top ?? 0,
    bottom: insets?.bottom ?? 0,
    left: insets?.left ?? 0,
    right: insets?.right ?? 0,
  };
}

/** Viewport balandligi va kengaytirilganlik holati */
export function getTelegramViewport(): { height: number; stableHeight: number; isExpanded: boolean } {
  const tg = getTelegramWebApp();
  if (!tg) {
    return {
      height: typeof window !== 'undefined' ? window.innerHeight : 0,
      stableHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
      isExpanded: true,
    };
  }
  return {
    height: tg.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
    stableHeight: tg.viewportStableHeight ?? tg.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
    isExpanded: Boolean(tg.isExpanded),
  };
}

/** WebApp tayyor ekanini xabar qilish */
export function telegramReady(): void {
  try {
    getTelegramWebApp()?.ready();
  } catch {
    // jimgina fallback
  }
}

/** WebApp ni to'liq ekranga yoyish */
export function telegramExpand(): void {
  try {
    getTelegramWebApp()?.expand();
  } catch {
    // jimgina fallback
  }
}

/** Vertikal swipe bilan yopilishni o'chirish (7.7+) */
export function telegramDisableVerticalSwipes(): void {
  try {
    const tg = getTelegramWebApp();
    if (tg?.disableVerticalSwipes) {
      tg.disableVerticalSwipes();
    }
  } catch {
    // jimgina fallback
  }
}

/** Telegram WebApp versiyasi tekshiruvi */
export function isTelegramVersionAtLeast(version: string): boolean {
  try {
    const tg = getTelegramWebApp();
    if (!tg) return false;
    if (typeof tg.isVersionAtLeast === 'function') {
      return tg.isVersionAtLeast(version);
    }
    // Oddiy semver taqqoslash fallback
    const current = (tg.version || '6.0').split('.').map(Number);
    const target = version.split('.').map(Number);
    for (let i = 0; i < Math.max(current.length, target.length); i++) {
      const c = current[i] || 0;
      const t = target[i] || 0;
      if (c > t) return true;
      if (c < t) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Havolani ochish: Telegram ichida openLink, tashqarida window.open */
export function telegramOpenLink(url: string, options?: { tryInstantView?: boolean }): void {
  try {
    const tg = getTelegramWebApp();
    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url, { try_instant_view: options?.tryInstantView });
      return;
    }
  } catch {
    // fallback
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** HapticFeedback tebranish effekti (ortiqcha chaqirilmaydi) */
export function telegramHaptic(
  type: 'impact' | 'notification' | 'selection',
  style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'error' | 'success' | 'warning',
): void {
  try {
    const haptic = getTelegramWebApp()?.HapticFeedback;
    if (!haptic) return;

    if (type === 'impact') {
      haptic.impactOccurred((style as 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') || 'medium');
    } else if (type === 'notification') {
      haptic.notificationOccurred((style as 'error' | 'success' | 'warning') || 'success');
    } else if (type === 'selection') {
      haptic.selectionChanged();
    }
  } catch {
    // jimgina fallback
  }
}

/** Tasdiqlash dialogi: Telegram native showConfirm */
export function telegramShowConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tg = getTelegramWebApp();
      if (tg && typeof tg.showConfirm === 'function') {
        tg.showConfirm(message, (confirmed) => {
          resolve(Boolean(confirmed));
        });
        return;
      }
    } catch {
      // fallback
    }
    resolve(true);
  });
}

/** Xabar dialogi: Telegram native showAlert */
export function telegramShowAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tg = getTelegramWebApp();
      if (tg && typeof tg.showAlert === 'function') {
        tg.showAlert(message, () => resolve());
        return;
      }
    } catch {
      // fallback
    }
    resolve();
  });
}

/** Forma to'ldirilganda tasodifiy yopilishdan himoyalash (closing confirmation) */
export function setTelegramClosingConfirmation(enabled: boolean): void {
  try {
    const tg = getTelegramWebApp();
    if (!tg) return;
    if (enabled && typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation();
    } else if (!enabled && typeof tg.disableClosingConfirmation === 'function') {
      tg.disableClosingConfirmation();
    }
  } catch {
    // jimgina fallback
  }
}

/**
 * BackButton ulanishi va unmount da tozalanishi (D-166).
 * Qaytadigan funksiya unmount da tozalash uchun chaqiriladi.
 */
export function bindTelegramBackButton(onClick: () => void): () => void {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return () => {};

  try {
    tg.BackButton.onClick(onClick);
    tg.BackButton.show();
  } catch {
    return () => {};
  }

  return () => {
    try {
      tg.BackButton.offClick(onClick);
      tg.BackButton.hide();
    } catch {
      // jimgina fallback
    }
  };
}

/**
 * MainButton ulanishi, parametrlar o'rnatilishi va unmount da tozalanishi (D-166).
 * Qaytadigan funksiya unmount da tozalash uchun chaqiriladi.
 */
export function bindTelegramMainButton(params: {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isActive?: boolean;
  isProgress?: boolean;
  color?: string;
  textColor?: string;
}): () => void {
  const tg = getTelegramWebApp();
  if (!tg?.MainButton) return () => {};

  try {
    tg.MainButton.setParams({
      text: params.text,
      is_visible: params.isVisible ?? true,
      is_active: params.isActive ?? true,
      color: params.color,
      text_color: params.textColor,
    });
    tg.MainButton.onClick(params.onClick);
    if (params.isProgress) {
      tg.MainButton.showProgress(params.isActive ?? true);
    } else {
      tg.MainButton.hideProgress();
    }
    if (params.isVisible !== false) {
      tg.MainButton.show();
    }
  } catch {
    return () => {};
  }

  return () => {
    try {
      tg.MainButton.offClick(params.onClick);
      tg.MainButton.hideProgress();
      tg.MainButton.hide();
    } catch {
      // jimgina fallback
    }
  };
}

/**
 * start_param yoki URL dan startParam ni parse qilish (P14, D-166).
 * Masalan: sample_123, s_123 -> /samples/123
 */
export function parseStartParam(rawParam?: string): { path: string; id?: string } | null {
  let param = rawParam?.trim();
  if (!param && typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    param = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || undefined;
    if (!param) {
      const tg = getTelegramWebApp();
      param = tg?.initDataUnsafe?.start_param;
    }
  }

  if (!param) return null;

  // s_ID yoki sample_ID
  if (param.startsWith('sample_')) {
    const id = param.replace('sample_', '');
    return { path: `/samples/${id}`, id };
  }
  if (param.startsWith('s_')) {
    const id = param.replace('s_', '');
    return { path: `/samples/${id}`, id };
  }

  // r_ID yoki registry_ID
  if (param.startsWith('registry_')) {
    const id = param.replace('registry_', '');
    return { path: `/registry/${id}`, id };
  }
  if (param.startsWith('r_')) {
    const id = param.replace('r_', '');
    return { path: `/registry/${id}`, id };
  }

  // st_ID yoki stability_ID
  if (param.startsWith('stability_')) {
    const id = param.replace('stability_', '');
    return { path: `/stability/${id}`, id };
  }
  if (param.startsWith('st_')) {
    const id = param.replace('st_', '');
    return { path: `/stability/${id}`, id };
  }

  // To'g'ridan bo'limlar
  switch (param) {
    case 'samples':
      return { path: '/samples' };
    case 'registry':
      return { path: '/registry' };
    case 'reagents':
      return { path: '/reagents' };
    case 'temperature':
      return { path: '/temperature' };
    case 'stability':
      return { path: '/stability' };
    case 'me':
      return { path: '/me' };
    case 'team':
      return { path: '/team' };
    case 'profile':
      return { path: '/profile' };
    default:
      return null;
  }
}

/**
 * Rol bo'yicha sahifaga kirish ruxsatini tekshirish (P14, D-166).
 * Ruxsatsiz rolga 403 so'rov yuborilmasligi uchun deep linkdan oldin tekshiriladi.
 */
export function canRoleAccessPath(role: string | undefined, path: string): boolean {
  if (!role) return false;
  if (path === '/' || path === '/profile') return true;

  // Super admin sahifalari
  if (path.startsWith('/companies') || path.startsWith('/logs')) {
    return role === 'super_admin';
  }

  // Super admin kompaniya sahifalariga kira olmaydi (spec §1, D-28)
  if (role === 'super_admin') return false;

  // Umumiy kompaniya rollari (chemist, kontrolyor, lab_head, director, admin)
  const isCompanyRole =
    role === 'chemist' ||
    role === 'kontrolyor' ||
    role === 'lab_head' ||
    role === 'director' ||
    role === 'admin';

  if (
    path.startsWith('/samples') ||
    path.startsWith('/registry') ||
    path.startsWith('/substances') ||
    path.startsWith('/reagents') ||
    path.startsWith('/expenses') ||
    path.startsWith('/temperature') ||
    path.startsWith('/stability')
  ) {
    return isCompanyRole;
  }

  // Boshqaruv rollari (lab_head, director, admin)
  if (path.startsWith('/users') || path.startsWith('/activity')) {
    return role === 'lab_head' || role === 'director' || role === 'admin';
  }

  // P13 analitika ruxsatlari (D-159)
  if (path === '/me') {
    return role === 'chemist' || role === 'kontrolyor' || role === 'lab_head' || role === 'director';
  }
  if (path.startsWith('/team')) {
    return role === 'lab_head' || role === 'director';
  }

  return false;
}
