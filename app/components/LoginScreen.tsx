import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock } from 'lucide-react';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [msg, setMsg] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg('');
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) setMsg(error.message);
            else setMsg('Account erstellt! Du bist eingeloggt.');
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) setMsg(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
                <div className="flex justify-center mb-6"><div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white"><Lock size={24} /></div></div>
                <h1 className="text-2xl font-bold text-center mb-1 text-gray-900">Agentur OS</h1>
                <p className="text-center text-gray-500 text-sm mb-8">Bitte melde dich an</p>
                <form onSubmit={handleAuth} className="space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label><input type="email" required className="w-full rounded-lg border-gray-200 text-sm py-2.5 px-3 bg-gray-50 outline-none focus:ring-2 focus:ring-gray-900 transition" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Passwort</label><input type="password" required minLength={6} className="w-full rounded-lg border-gray-200 text-sm py-2.5 px-3 bg-gray-50 outline-none focus:ring-2 focus:ring-gray-900 transition" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                    {msg && <div className="text-xs text-red-500 text-center">{msg}</div>}
                    <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg disabled:opacity-50 transition">{loading ? 'Lade...' : (isSignUp ? 'Account erstellen' : 'Anmelden')}</button>
                </form>
                <div className="mt-6 text-center"><button onClick={() => { setIsSignUp(!isSignUp); setMsg(''); }} className="text-xs text-gray-400 hover:text-gray-900 transition">{isSignUp ? 'Zurück zum Login' : 'Noch keinen Account? Registrieren'}</button></div>
            </div>
        </div>
    );
}
