import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, ArrowLeft } from 'lucide-react';

type Mode = 'login' | 'signup' | 'forgot';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('login');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const clearErrors = () => {
        setEmailError('');
        setPasswordError('');
        setSuccessMsg('');
    };

    const switchMode = (next: Mode) => {
        clearErrors();
        setMode(next);
    };

    const parseError = (message: string) => {
        const lower = message.toLowerCase();
        if (lower.includes('invalid login') || lower.includes('invalid credentials') || lower.includes('wrong password')) {
            setPasswordError('E-Mail oder Passwort ist falsch.');
        } else if (lower.includes('email not confirmed')) {
            setEmailError('Bitte bestätige zuerst deine E-Mail-Adresse.');
        } else if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already')) {
            setEmailError('Diese E-Mail-Adresse ist bereits registriert.');
        } else if (lower.includes('password') && (lower.includes('6') || lower.includes('short') || lower.includes('weak'))) {
            setPasswordError('Das Passwort muss mindestens 6 Zeichen lang sein.');
        } else if (lower.includes('email') && (lower.includes('invalid') || lower.includes('format'))) {
            setEmailError('Bitte gib eine gültige E-Mail-Adresse ein.');
        } else {
            setPasswordError(message);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        clearErrors();

        if (mode === 'forgot') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) setEmailError(error.message);
            else setSuccessMsg('E-Mail zum Zurücksetzen wurde gesendet!');
        } else if (mode === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) parseError(error.message);
            else setSuccessMsg('Account erstellt! Bitte bestätige deine E-Mail-Adresse.');
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) parseError(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-subtle font-sans p-4">
            <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-sm border border-default">
                <div className="flex justify-center mb-5">
                    <div className="w-12 h-12 bg-text-primary rounded-xl flex items-center justify-center text-surface">
                        <Lock size={24} />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-6 text-text-primary">Agentur OS</h1>

                {mode === 'forgot' ? (
                    <>
                        <button
                            type="button"
                            onClick={() => switchMode('login')}
                            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition mb-4 -ml-0.5"
                        >
                            <ArrowLeft size={13} /> Zurück zum Login
                        </button>
                        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                            Gib deine E-Mail-Adresse ein – wir schicken dir einen Link zum Zurücksetzen.
                        </p>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    autoFocus
                                    className={`w-full rounded-xl border text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 transition ${emailError ? 'border-red-400 focus:ring-red-400/30' : 'border-default focus:ring-accent'}`}
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                                />
                                {emailError && <p className="text-xs text-red-500 mt-1.5 px-1">{emailError}</p>}
                            </div>

                            {successMsg && (
                                <div className="text-xs px-3 py-2.5 rounded-xl bg-green-500/10 text-green-600 border border-green-500/20">
                                    {successMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl bg-text-primary text-surface text-sm font-medium hover:opacity-90 shadow-lg disabled:opacity-50 transition"
                            >
                                {loading ? 'Sende...' : 'Link senden'}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        {/* Login / Registrieren Tabs */}
                        <div className="flex bg-subtle rounded-xl p-1 mb-6">
                            <button
                                type="button"
                                onClick={() => switchMode('login')}
                                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition ${mode === 'login' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                            >
                                Anmelden
                            </button>
                            <button
                                type="button"
                                onClick={() => switchMode('signup')}
                                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition ${mode === 'signup' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                            >
                                Registrieren
                            </button>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    className={`w-full rounded-xl border text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 transition ${emailError ? 'border-red-400 focus:ring-red-400/30' : 'border-default focus:ring-accent'}`}
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                                />
                                {emailError && <p className="text-xs text-red-500 mt-1.5 px-1">{emailError}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Passwort</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className={`w-full rounded-xl border text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 transition ${passwordError ? 'border-red-400 focus:ring-red-400/30' : 'border-default focus:ring-accent'}`}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                                />
                                <div className="flex justify-between items-start mt-1.5 px-1 min-h-[16px]">
                                    <span className="text-xs text-red-500 leading-tight">{passwordError}</span>
                                    {mode === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => switchMode('forgot')}
                                            className="text-[10px] text-text-muted hover:text-accent transition-colors font-semibold flex-shrink-0 ml-2"
                                        >
                                            Passwort vergessen?
                                        </button>
                                    )}
                                </div>
                            </div>

                            {successMsg && (
                                <div className="text-xs px-3 py-2.5 rounded-xl bg-green-500/10 text-green-600 border border-green-500/20">
                                    {successMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl bg-text-primary text-surface text-sm font-medium hover:opacity-90 shadow-lg disabled:opacity-50 transition"
                            >
                                {loading ? 'Lade...' : mode === 'signup' ? 'Account erstellen' : 'Anmelden'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
