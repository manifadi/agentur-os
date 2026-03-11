import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock } from 'lucide-react';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'error' | 'success'>('error');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg('');
        setMsgType('error');

        if (isForgotPassword) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) {
                setMsg(error.message);
            } else {
                setMsgType('success');
                setMsg('E-Mail zum Zurücksetzen wurde gesendet!');
            }
        } else if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) setMsg(error.message);
            else {
                setMsgType('success');
                setMsg('Account erstellt! Bitte bestätige deine E-Mail und richte dein Profil ein.');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) setMsg(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-subtle font-sans p-4">
            <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-sm border border-default">
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 bg-text-primary rounded-xl flex items-center justify-center text-surface">
                        <Lock size={24} />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-1 text-text-primary">Agentur OS</h1>
                <p className="text-center text-text-secondary text-sm mb-8">
                    {isForgotPassword ? 'Passwort zurücksetzen' : 'Bitte melde dich an'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full rounded-xl border-default text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 focus:ring-accent transition"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {!isForgotPassword && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase mb-1 px-1">Passwort</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full rounded-xl border-default text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 focus:ring-accent transition"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <div className="flex justify-end mt-1.5 px-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotPassword(true);
                                            setMsg('');
                                        }}
                                        className="text-[10px] text-text-muted hover:text-accent transition-colors font-semibold"
                                    >
                                        Passwort vergessen?
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {msg && (
                        <div className={`text-xs text-center px-2 py-1.5 rounded-xl ${msgType === 'success' ? 'bg-green-500/10 text-green-500' : 'text-red-500'}`}>
                            {msg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-text-primary text-surface text-sm font-medium hover:opacity-90 shadow-lg disabled:opacity-50 transition"
                    >
                        {loading ? 'Lade...' : isForgotPassword ? 'Link senden' : isSignUp ? 'Account erstellen' : 'Anmelden'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            if (isForgotPassword) {
                                setIsForgotPassword(false);
                            } else {
                                setIsSignUp(!isSignUp);
                            }
                            setMsg('');
                        }}
                        className="text-xs text-text-muted hover:text-text-primary transition"
                    >
                        {isForgotPassword ? 'Zurück zum Login' : isSignUp ? 'Zurück zum Login' : 'Noch keinen Account? Registrieren'}
                    </button>
                </div>
            </div>
        </div>
    );
}
