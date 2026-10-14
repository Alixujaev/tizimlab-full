import { create } from 'zustand';

export const SIDEBAR_STORAGE_KEY = 'tizimlab.sidebar';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

interface LayoutState {
  /** Desktop'da sidebar ixcham (faqat ikonlar) — tanlov saqlanadi. */
  sidebarCollapsed: boolean;
  /** Mobil navigatsiya (Drawer) ochiqmi. */
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()((set, get) => ({
  sidebarCollapsed: readCollapsed(),
  mobileNavOpen: false,
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      // saqlab bo'lmasa ham joriy sessiyada ishlaydi
    }
    set({ sidebarCollapsed: next });
  },
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
