// Zentrale Fehler-Meldung. EIN Ort, an dem alle gefangenen Fehler landen —
// aktuell Console + Server-Endpoint (in Vercel-Logs sichtbar). Später lässt
// sich hier mit einer Zeile Sentry o.ä. andocken, ohne alle Call-Sites zu ändern.
//
// Wirft NIE — Fehler-Reporting darf nie selbst die App crashen.

export interface ErrorContext {
    /** Wo kam der Fehler her, z.B. 'route-error-boundary', 'calendar-sync'. */
    source?: string;
    [key: string]: unknown;
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
    try {
        const payload = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ...context,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            ts: new Date().toISOString(),
        };

        // Immer in die Console (Server-Logs / DevTools).
        console.error('[reportError]', payload);

        // Client → Server melden (best-effort, blockiert nichts).
        if (typeof window !== 'undefined') {
            fetch('/api/client-errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(() => { /* egal */ });
        }

        // ── Sentry-Andockpunkt (später) ──────────────────────────────
        // if (typeof window !== 'undefined' && (window as any).Sentry) {
        //     (window as any).Sentry.captureException(error, { extra: context });
        // }
    } catch {
        /* Reporting darf nie werfen. */
    }
}
