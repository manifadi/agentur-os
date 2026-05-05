'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState('');

    useEffect(() => {
        const code = searchParams.get('code');

        if (!code) {
            router.replace('/');
            return;
        }

        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
                setError('Der Einladungslink ist abgelaufen oder ungültig. Bitte einen neuen Link anfordern.');
            } else {
                router.replace('/onboarding');
            }
        });
    }, []);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-subtle p-4">
                <div className="bg-surface max-w-md w-full p-8 rounded-2xl shadow-xl text-center border border-default">
                    <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-text-primary mb-2">Link ungültig</h1>
                    <p className="text-sm text-text-muted mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-5 py-2.5 bg-accent text-surface rounded-xl text-sm font-bold hover:opacity-90 transition"
                    >
                        Zum Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-subtle gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-muted">Einladung wird bestätigt…</p>
        </div>
    );
}
