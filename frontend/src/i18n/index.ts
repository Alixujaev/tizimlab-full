import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';
import uz from './locales/uz.json';

export const LANGUAGES = ['uz', 'ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'uz';
export const LANGUAGE_STORAGE_KEY = 'tizimlab.lang';

export const resources = {
  uz: { translation: uz },
  ru: { translation: ru },
  en: { translation: en },
} as const;

const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language);

// localStorage brauzer sozlamalari tufayli mavjud bo'lmasligi mumkin — xatoni yutamiz
function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Tilni almashtiradi, localStorage'da saqlaydi (D-27). `<html lang>` `languageChanged` orqali yangilanadi. */
export async function changeLanguage(lng: Language): Promise<void> {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // saqlab bo'lmasa ham til joriy sessiyada almashadi
  }
  await i18n.changeLanguage(lng);
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
});
document.documentElement.lang = i18n.language;

export default i18n;
