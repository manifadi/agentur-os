'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * Persistiert State in localStorage. SSR-sicher: liest erst nach Mount,
 * damit Server- und Client-HTML matchen.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
    const [value, setValue] = useState<T>(initial);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(key);
            if (raw !== null) setValue(JSON.parse(raw));
        } catch {
            // ignore parse / storage errors
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const update = useCallback((v: T | ((prev: T) => T)) => {
        setValue(prev => {
            const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
            try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* */ }
            return next;
        });
    }, [key]);

    return [value, update];
}
