import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'tizimlab.theme';

const isPreference = (v: unknown): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

// localStorage mavjud bo'lmasligi mumkin (maxfiy rejim, bloklangan) — xato yutiladi
function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * D-154: `system` — `<html>` da `data-theme` yo'q, tokenlar `prefers-color-scheme` ga ergashadi;
 * `light`/`dark` — `data-theme` qo'lda tanlovni majburlaydi.
 */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  preference: readStored(),
  setPreference: (preference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // saqlab bo'lmasa ham joriy sessiyada qo'llanadi
    }
    applyTheme(preference);
    set({ preference });
  },
}));

// Birinchi chizishdan oldin saqlangan tanlovni qo'llash (yorug'/qorong'i "miltillash" bo'lmasin)
applyTheme(useThemeStore.getState().preference);
