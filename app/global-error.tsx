'use client';

import { useEffect } from 'react';
import { reportError } from './utils/reportError';

// Fängt Fehler, die das Root-Layout selbst betreffen (sonst Whitescreen).
// Ersetzt den kompletten <html>-Baum → muss eigene html/body liefern und nutzt
// Inline-Styles, da hier u.U. kein globales CSS geladen ist.
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        reportError(error, { source: 'global-error-boundary', digest: error.digest });
    }, [error]);

    return (
        <html lang="de">
            <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', color: '#111827' }}>
                <div style={{ textAlign: 'center', padding: 32, maxWidth: 440 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Etwas ist schiefgelaufen</h2>
                    <p style={{ color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 }}>
                        Ein unerwarteter Fehler ist aufgetreten und wurde protokolliert. Bitte versuche es erneut.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{ background: '#111827', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
                    >
                        Neu laden
                    </button>
                </div>
            </body>
        </html>
    );
}
