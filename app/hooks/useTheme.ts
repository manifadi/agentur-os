'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'default' | 'blue' | 'violet' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'slate';
export type FontFamily = 'inter' | 'outfit' | 'dm-sans' | 'playfair' | 'space-grotesk' | 'geist-mono';
export type BackgroundStyle = 'clean' | 'subtle' | 'canvas';

export interface ThemePreferences {
    themeMode: ThemeMode;
    accentColor: AccentColor;
    fontFamily: FontFamily;
    backgroundStyle: BackgroundStyle;
    isSidebarExpanded: boolean;
}

const FONT_MAP: Record<FontFamily, string> = {
    'inter': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    'outfit': "'Outfit', -apple-system, sans-serif",
    'dm-sans': "'DM Sans', -apple-system, sans-serif",
    'playfair': "'Playfair Display', Georgia, serif",
    'space-grotesk': "'Space Grotesk', -apple-system, sans-serif",
    'geist-mono': "'Geist Mono', 'SF Mono', 'Monaco', monospace",
};

const DEFAULT_PREFS: ThemePreferences = {
    themeMode: 'light',
    accentColor: 'default',
    fontFamily: 'inter',
    backgroundStyle: 'clean',
    isSidebarExpanded: false,
};

function getLocalPrefs(): ThemePreferences {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    try {
        const stored = localStorage.getItem('agentur-os-theme');
        if (!stored) {
            // Migrate old sidebar state
            const oldSidebar = localStorage.getItem('sidebarExpanded');
            return { ...DEFAULT_PREFS, isSidebarExpanded: oldSidebar ? JSON.parse(oldSidebar) : false };
        }
        return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    } catch {
        return DEFAULT_PREFS;
    }
}

function applyTheme(prefs: ThemePreferences) {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    // Resolve mode (handle 'system')
    const resolvedDark =
        prefs.themeMode === 'dark' ||
        (prefs.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (resolvedDark) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }

    // Accent color
    if (prefs.accentColor === 'default') {
        html.removeAttribute('data-accent');
    } else {
        html.setAttribute('data-accent', prefs.accentColor);
    }

    // Background style
    if (prefs.backgroundStyle === 'clean') {
        html.removeAttribute('data-bg');
    } else {
        html.setAttribute('data-bg', prefs.backgroundStyle);
    }

    // Font family
    html.style.setProperty('--font-family', FONT_MAP[prefs.fontFamily]);
    document.body.style.fontFamily = 'var(--font-family)';
}

export function useTheme(employeeId?: string) {
    const [prefs, setPrefs] = useState<ThemePreferences>(DEFAULT_PREFS);
    const [loaded, setLoaded] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load on mount (from localStorage first, then Supabase)
    useEffect(() => {
        const localPrefs = getLocalPrefs();
        setPrefs(localPrefs);
        applyTheme(localPrefs);
        setLoaded(true);
    }, []);

    // Load from Supabase when user is available
    useEffect(() => {
        if (!employeeId) return;
        supabase
            .from('employees')
            .select('ui_preferences')
            .eq('id', employeeId)
            .single()
            .then(({ data, error }) => {
                if (error || !data?.ui_preferences) return;
                const dbPrefs = { ...DEFAULT_PREFS, ...data.ui_preferences } as ThemePreferences;
                setPrefs(dbPrefs);
                applyTheme(dbPrefs);
                localStorage.setItem('agentur-os-theme', JSON.stringify(dbPrefs));
            });
    }, [employeeId]);

    // Listen for system dark mode changes
    useEffect(() => {
        if (prefs.themeMode !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme(prefs);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [prefs.themeMode]);

    // Persist changes (debounced to Supabase, immediate to localStorage)
    const savePrefs = useCallback((newPrefs: ThemePreferences, empId?: string) => {
        localStorage.setItem('agentur-os-theme', JSON.stringify(newPrefs));
        // Also keep old key for backward compat
        localStorage.setItem('sidebarExpanded', JSON.stringify(newPrefs.isSidebarExpanded));

        if (!empId) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            supabase
                .from('employees')
                .update({ ui_preferences: newPrefs })
                .eq('id', empId)
                .then(({ error }) => {
                    if (error) console.error('[useTheme] Failed to save to Supabase:', error);
                });
        }, 800);
    }, []);

    const updatePrefs = useCallback(
        (patch: Partial<ThemePreferences>) => {
            setPrefs(prev => {
                const next = { ...prev, ...patch };
                applyTheme(next);
                savePrefs(next, employeeId);
                return next;
            });
        },
        [employeeId, savePrefs]
    );

    // Expose sidebar toggle that goes through theme system
    const setSidebarExpanded = useCallback(
        (expanded: boolean) => updatePrefs({ isSidebarExpanded: expanded }),
        [updatePrefs]
    );

    return {
        prefs,
        loaded,
        updateThemePrefs: updatePrefs,
        setSidebarExpanded,
        isSidebarExpanded: prefs.isSidebarExpanded,
    };
}
