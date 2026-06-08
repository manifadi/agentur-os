import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';

export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';
export const LOCALE_STORAGE_KEY = 'vela_locale';

export function isLocale(v: unknown): v is Locale {
    return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

// Singleton-Init (HMR-/StrictMode-fest). lng = DEFAULT_LOCALE für den ersten
// Render (Server + Client identisch → keine Hydration-Mismatches); die echte
// Nutzer-Sprache wird nach dem Mount via changeLanguage gesetzt.
if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
        resources: {
            de: { translation: de },
            en: { translation: en },
        },
        lng: DEFAULT_LOCALE,
        fallbackLng: DEFAULT_LOCALE,   // fehlende EN-Keys → Deutsch (nichts bricht)
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
    });
}

export default i18n;
