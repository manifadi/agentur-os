'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

// Geschlossene Testphase: Zugang ausschließlich per Einladung. Diese Seite ist nur
// noch eine Durchgangsstation:
//   • Eingeladene Accounts werden mit ihrem Mitarbeiter-Eintrag verknüpft → Dashboard.
//   • Accounts ohne Agentur sehen einen klaren Hinweis (kein Self-Service mehr).
type Status = 'checking' | 'linking' | 'noaccess';

// ── Shell ─────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg-app)' }}>
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="flex justify-center mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/25">
                        <Building2 size={22} className="text-accent-text" strokeWidth={2.5} />
                    </div>
                </div>
                <div className="bg-surface rounded-3xl shadow-xl border border-default p-8">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    const router = useRouter();
    const { session, employees } = useApp();

    const [status, setStatus] = useState<Status>('checking');

    // ── Auto-detect: hat dieser Account schon eine Agentur? ───────
    const detect = useCallback(async () => {
        if (!session?.user?.email) return;
        setStatus('checking');

        // Schon im Kontext bekannt? → Dashboard
        const alreadyInContext = employees.find(e => e.email === session.user.email);
        if (alreadyInContext) { router.replace('/dashboard'); return; }

        // Account zuverlässig mit dem Mitarbeiter-Eintrag verknüpfen — serverseitig
        // über den Service-Role-Key. Unabhängig von der link_invited_employee-RPC
        // (muss manuell deployed sein) und vom generateLink-user-Feld (bei magiclink
        // nicht immer vorhanden). Das war die Ursache, warum Eingeladene auf dem
        // "Kein Zugang"-Screen landeten.
        setStatus('linking');
        try {
            const res = await fetch('/api/link-account', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token ?? ''}` },
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.linked) { router.replace('/dashboard'); return; }
        } catch {
            // Netzwerkfehler → unten via RLS-Query gegenprüfen
        }

        // Fallback: bereits verknüpft? Dann ist der Eintrag via RLS sichtbar.
        const { data: empRow } = await supabase
            .from('employees').select('id').eq('email', session.user.email).maybeSingle();
        if (empRow) { router.replace('/dashboard'); return; }

        // Kein Mitarbeiter-Eintrag → kein Zugang (Einladung-only).
        setStatus('noaccess');
    }, [session, employees, router]);

    useEffect(() => { detect(); }, [detect]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    // ─────────────────────────────────────────────────────────────
    // SCREENS
    // ─────────────────────────────────────────────────────────────

    if (status === 'checking' || status === 'linking') {
        const label = status === 'linking' ? 'Einladung wird verknüpft…' : 'Prüfe Zugang…';
        return (
            <Shell>
                <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 size={32} className="animate-spin text-accent" />
                    <p className="text-sm font-medium text-text-muted">{label}</p>
                </div>
            </Shell>
        );
    }

    // ── Kein Zugang (Einladung-only) ──────────────────────────────
    return (
        <Shell>
            <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                    <Mail size={26} strokeWidth={2} />
                </div>
                <div>
                    <h1 className="text-xl font-black text-text-primary mb-2">Noch kein Zugang</h1>
                    <p className="text-sm text-text-muted max-w-xs leading-relaxed">
                        Dieser Account ist noch keiner Agentur zugeordnet. Der Zugang zu Vela
                        läuft aktuell nur über eine Einladung.
                    </p>
                    <p className="text-xs text-text-placeholder mt-4">
                        Angemeldet als <span className="font-semibold text-text-secondary">{session?.user?.email}</span>
                    </p>
                    <p className="text-xs text-text-placeholder mt-3 max-w-xs leading-relaxed">
                        Du wurdest eingeladen? Nutze den Link aus der Einladungs-Mail und stelle sicher,
                        dass du mit genau dieser E-Mail-Adresse angemeldet bist.
                    </p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-4">
                    <button
                        onClick={() => detect()}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition"
                    >
                        <RefreshCw size={15} /> Zugang neu prüfen
                    </button>
                    <button onClick={handleLogout} className="text-xs text-text-placeholder hover:text-text-secondary transition py-2">
                        Abmelden
                    </button>
                </div>
            </div>
        </Shell>
    );
}
