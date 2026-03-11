import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Check } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'error' | 'success'>('error');
    const [isDone, setIsDone] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMsg('Passwörter stimmen nicht überein');
            setMsgType('error');
            return;
        }

        setLoading(true);
        setMsg('');
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setMsg(error.message);
            setMsgType('error');
        } else {
            setMsg('Passwort erfolgreich geändert!');
            setMsgType('success');
            setIsDone(true);
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-subtle font-sans p-4">
            <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-sm border border-default">
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 bg-text-primary rounded-xl flex items-center justify-center text-surface">
                        {isDone ? <Check size={24} /> : <Lock size={24} />}
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-1 text-text-primary">Neues Passwort</h1>
                <p className="text-center text-text-secondary text-sm mb-8">
                    Gib dein neues Passwort ein
                </p>

                {!isDone ? (
                    <form onSubmit={handleReset} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Neues Passwort</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="w-full rounded-xl border-default text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 focus:ring-accent transition"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Passwort bestätigen</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="w-full rounded-xl border-default text-sm py-2.5 px-3 bg-subtle text-text-primary outline-none focus:ring-2 focus:ring-accent transition"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

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
                            {loading ? 'Speichere...' : 'Passwort speichern'}
                        </button>
                    </form>
                ) : (
                    <div className="text-center py-4">
                        <div className="text-green-500 font-medium mb-2">Erfolgreich!</div>
                        <p className="text-text-secondary text-sm text-center">Du wirst zum Login weitergeleitet...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
