'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export default function OnboardingPage() {
    const router = useRouter();
    const { session, employees } = useApp();

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [orgId, setOrgId] = useState('');

    // Data
    const [organizations, setOrganizations] = useState<{ id: string, name: string }[]>([]);

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'submitted' | 'checking' | 'rejected'>('checking');

    // Fetch Orgs
    useEffect(() => {
        const fetchOrgs = async () => {
            const { data } = await supabase.from('organizations').select('id, name').order('name');
            if (data) setOrganizations(data);
        };
        fetchOrgs();
    }, []);

    // Check if user is already approved (redirect to dashboard)
    useEffect(() => {
        if (!session?.user?.email) return;

        // Optimization: Use the employees list from context if loaded
        const checkApproval = async () => {
            // If we have employees loaded, check locally first
            const currentUser = employees.find(e => e.email === session.user.email);
            if (currentUser) {
                router.replace('/dashboard');
                return;
            }

            // Also check DB directly to be sure (if context is stale or empty initially)
            const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
            if (data) {
                router.replace('/dashboard');
            } else {
                // Check if there is a pending OR rejected request (fetch latest)
                const { data: request } = await supabase.from('registration_requests')
                    .select('status')
                    .eq('email', session.user.email)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (request) {
                    if (request.status === 'pending') {
                        setStatus('submitted');
                    } else if (request.status === 'rejected') {
                        setStatus('rejected');
                    } else {
                        setStatus('idle');
                    }
                } else {
                    setStatus('idle');
                }
            }
        };

        checkApproval();
    }, [session, employees, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user?.email) return;

        setLoading(true);
        const fullName = `${firstName} ${lastName}`.trim();

        // 1. Check if email is already in ANY organization
        const { data: existingUser } = await supabase.from('employees').select('id, organization_id').eq('email', session.user.email).maybeSingle();

        if (existingUser) {
            alert('Du bist bereits Teil einer Organisation! Bitte melde dich an.');
            // Optionally redirect or force logout?
            setLoading(false);
            return;
        }

        // 2. Check for existing request to Update vs Insert
        const { data: existingReq } = await supabase.from('registration_requests')
            .select('id, status')
            .eq('email', session.user.email)
            .maybeSingle();

        if (existingReq) {
            // Update existing request
            const { error } = await supabase.from('registration_requests').update({
                name: fullName,
                organization_id: orgId || null,
                status: 'pending' // Reset to pending if it was rejected or anything else
            }).eq('id', existingReq.id);

            if (error) {
                console.error(error);
                alert(`Fehler beim Aktualisieren der Anfrage: ${error.message}`);
            } else {
                setStatus('submitted');
            }
        } else {
            // Insert new request
            const { error } = await supabase.from('registration_requests').insert([{
                email: session.user.email,
                name: fullName,
                organization_id: orgId || null,
                status: 'pending'
            }]);

            if (error) {
                console.error(error);
                alert(`Fehler beim Senden der Anfrage: ${error.message}`);
            } else {
                setStatus('submitted');
            }
        }

        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/'); // Login screen
    };

    if (status === 'checking') {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Lade Status...</div>;
    }

    if (status === 'rejected') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Anfrage abgelehnt</h1>
                    <p className="text-gray-500 mb-8">
                        Deine Beitrittsanfrage wurde leider abgelehnt. Bitte wende dich an einen Administrator oder versuche es erneut.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 font-medium">
                            Abmelden
                        </button>
                        <button onClick={() => setStatus('idle')} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition">
                            Erneut versuchen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'submitted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Anfrage gesendet</h1>
                    <p className="text-gray-500 mb-8">
                        Deine Beitrittsanfrage wird geprüft. Sobald dein Admin dich freischaltet, erhältst du Zugriff auf das Dashboard.
                    </p>
                    <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 font-medium">
                        Abmelden
                    </button>
                    {/* Poll/Refresh button just in case? Or rely on reload */}
                    <button onClick={() => window.location.reload()} className="block mx-auto mt-4 text-xs text-blue-600 hover:underline">
                        Status prüfen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Profil einrichten</h1>
                    <p className="text-gray-500">Bitte wähle deine Organisation und gib deinen Namen ein.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Organisation / Firma</label>
                        <select
                            required
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none transition bg-white"
                            value={orgId}
                            onChange={e => setOrgId(e.target.value)}
                        >
                            <option value="">Bitte wählen...</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">Du musst einer bestehenden Organisation beitreten.</p>
                    </div>

                    {orgId && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Vorname</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none transition"
                                        placeholder="Max"
                                        value={firstName}
                                        onChange={e => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nachname</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none transition"
                                        placeholder="Mustermann"
                                        value={lastName}
                                        onChange={e => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !orgId || !firstName || !lastName}
                        className="w-full bg-gray-900 text-white p-3 rounded-lg font-bold hover:bg-gray-800 transition disabled:opacity-50 mt-6"
                    >
                        {loading ? 'Sende...' : 'Speichern und anfragen'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">
                        Abmelden
                    </button>
                </div>
            </div>
        </div>
    );
}
