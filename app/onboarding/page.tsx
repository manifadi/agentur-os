'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import ConfirmModal from '../components/Modals/ConfirmModal';

type Status = 'checking' | 'linking' | 'idle' | 'submitted' | 'rejected';

export default function OnboardingPage() {
    const router = useRouter();
    const { session, employees } = useApp();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<Status>('checking');

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean; title: string; message: string; type: 'danger' | 'info' | 'warning' | 'success';
    }>({ isOpen: false, title: '', message: '', type: 'danger' });

    useEffect(() => {
        if (!session?.user?.email) return;

        const checkAndLink = async () => {
            setStatus('checking');

            // 1. Already in employees? → redirect
            const currentUser = employees.find(e => e.email === session.user.email);
            if (currentUser) { router.replace('/dashboard'); return; }

            const { data: empData } = await supabase
                .from('employees').select('id, user_id').eq('email', session.user.email).maybeSingle();

            if (empData) {
                if (empData.user_id) {
                    // Already linked → redirect
                    router.replace('/dashboard');
                    return;
                }
                // Pre-created via invite, but user_id not yet linked
                setStatus('linking');
                const { data: linked } = await supabase.rpc('link_invited_employee');
                if (linked) {
                    router.replace('/dashboard');
                    return;
                }
            }

            // 2. Check for pending/rejected registration request
            const { data: request } = await supabase
                .from('registration_requests')
                .select('status')
                .eq('email', session.user.email)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (request?.status === 'pending') setStatus('submitted');
            else if (request?.status === 'rejected') setStatus('rejected');
            else setStatus('idle');
        };

        checkAndLink();
    }, [session, employees, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user?.email) return;
        setLoading(true);

        const fullName = `${firstName} ${lastName}`.trim();

        const { data: existingUser } = await supabase
            .from('employees').select('id').eq('email', session.user.email).maybeSingle();

        if (existingUser) {
            setConfirmConfig({ isOpen: true, title: 'Konto bereits vorhanden', message: 'Du bist bereits Teil einer Organisation.', type: 'info' });
            setLoading(false);
            return;
        }

        const { data: existingReq } = await supabase
            .from('registration_requests').select('id').eq('email', session.user.email).maybeSingle();

        const payload = { name: fullName, organization_id: null as any, status: 'pending' };

        const { error } = existingReq
            ? await supabase.from('registration_requests').update(payload).eq('id', existingReq.id)
            : await supabase.from('registration_requests').insert([{ ...payload, email: session.user.email }]);

        if (error) {
            setConfirmConfig({ isOpen: true, title: 'Fehler', message: error.message, type: 'danger' });
        } else {
            setStatus('submitted');
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (status === 'checking' || status === 'linking') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-subtle gap-3">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <p className="text-sm text-text-muted">{status === 'linking' ? 'Konto wird verknüpft…' : 'Lade Status…'}</p>
            </div>
        );
    }

    if (status === 'rejected') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-subtle p-4">
                <div className="bg-surface max-w-md w-full p-8 rounded-2xl shadow-xl text-center border border-default">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">Anfrage abgelehnt</h1>
                    <p className="text-text-muted mb-8">Deine Beitrittsanfrage wurde abgelehnt. Wende dich an einen Admin oder versuche es erneut.</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={handleLogout} className="text-sm text-text-placeholder hover:text-text-primary font-medium">Abmelden</button>
                        <button onClick={() => setStatus('idle')} className="bg-accent text-surface px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition">Erneut versuchen</button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'submitted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-subtle p-4">
                <div className="bg-surface max-w-md w-full p-8 rounded-2xl shadow-xl text-center border border-default">
                    <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">Anfrage gesendet</h1>
                    <p className="text-text-muted mb-8">Dein Admin wird dich freischalten. Du erhältst dann automatisch Zugriff.</p>
                    <div className="flex flex-col gap-3 items-center">
                        <button onClick={() => window.location.reload()} className="px-5 py-2 bg-accent text-surface rounded-xl text-sm font-bold hover:opacity-90 transition">Status prüfen</button>
                        <button onClick={handleLogout} className="text-xs text-text-placeholder hover:text-text-primary font-medium">Abmelden</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-subtle p-4">
            <div className="bg-surface max-w-md w-full p-8 rounded-2xl shadow-xl border border-default">
                <div className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-5">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-1">Profil einrichten</h1>
                    <p className="text-text-muted text-sm">Gib deinen Namen ein — dein Admin schaltet dich dann frei.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-2">Vorname</label>
                            <input
                                type="text" required
                                className="w-full p-3 border border-border-strong rounded-xl text-sm bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                placeholder="Max"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-2">Nachname</label>
                            <input
                                type="text" required
                                className="w-full p-3 border border-border-strong rounded-xl text-sm bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                placeholder="Mustermann"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-text-muted">Angemeldet als: <span className="font-medium text-text-secondary">{session?.user?.email}</span></p>
                    <button
                        type="submit"
                        disabled={loading || !firstName || !lastName}
                        className="w-full bg-accent text-surface p-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 mt-2"
                    >
                        {loading ? 'Sende…' : 'Zugang anfragen'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={handleLogout} className="text-xs text-text-placeholder hover:text-text-secondary">Abmelden</button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                showCancel={false}
                type={confirmConfig.type}
                confirmText="OK"
            />
        </div>
    );
}
