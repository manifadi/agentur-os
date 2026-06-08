'use client';

import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { LOCALE_STORAGE_KEY, isLocale, DEFAULT_LOCALE, Locale } from './config';

/** Liest die gespeicherte Sprache (localStorage) — Fallback DEFAULT_LOCALE. */
export function getStoredLocale(): Locale {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    try {
        const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (isLocale(v)) return v;
    } catch { /* ignore */ }
    return DEFAULT_LOCALE;
}

/** Sprache umschalten + lokal persistieren (DB-Persistenz macht der Aufrufer). */
export function setStoredLocale(locale: Locale) {
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* ignore */ }
    if (i18n.language !== locale) i18n.changeLanguage(locale);
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
    // Nach dem Mount auf die gespeicherte Sprache wechseln (erster Render bleibt
    // DEFAULT_LOCALE → keine Hydration-Mismatches).
    useEffect(() => {
        const loc = getStoredLocale();
        if (i18n.language !== loc) i18n.changeLanguage(loc);
    }, []);

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
