'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { ImpersonationSession } from '../../types';
import { Eye, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImpersonationBanner() {
    const [session, setSession] = useState<ImpersonationSession | null>(null);
    const [stopping, setStopping] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            const { data } = await supabase.rpc('get_active_impersonation');
            if (cancelled) return;
            if (data && data.length > 0) setSession(data[0] as ImpersonationSession);
            else setSession(null);
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const stop = async () => {
        setStopping(true);
        const { error } = await supabase.rpc('stop_impersonation');
        if (error) {
            toast.error('Fehler: ' + error.message);
            setStopping(false);
            return;
        }
        toast.success('Impersonation beendet.');
        window.location.href = '/admin';
    };

    if (!session) return null;

    const expiresIn = Math.max(0, Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60_000));

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-4 px-4 py-2 text-[12px] font-semibold"
            style={{
                background: 'var(--color-warning-subtle)',
                color: 'var(--color-warning-text)',
                borderBottom: '1px solid var(--color-warning-border)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
        >
            <div className="flex items-center gap-2 min-w-0">
                <Eye size={14} className="shrink-0" />
                <span className="truncate">
                    Impersonation aktiv — du siehst gerade <strong>{session.target_org_name}</strong> als Support.
                    {expiresIn > 0 && <span className="opacity-70 ml-1.5">(läuft in {expiresIn} Min ab)</span>}
                </span>
            </div>
            <button
                onClick={stop}
                disabled={stopping}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition disabled:opacity-60"
                style={{ background: 'rgba(0,0,0,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
            >
                {stopping ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Beenden
            </button>
        </div>
    );
}
