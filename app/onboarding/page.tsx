'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserPlus, ArrowRight, ArrowLeft, Upload, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { uploadFileToSupabase } from '../utils/supabaseUtils';

type Status =
    | 'checking'
    | 'linking'
    | 'choice'
    | 'new_step1'
    | 'new_step2'
    | 'creating'
    | 'request_access'
    | 'submitted'
    | 'rejected';

// ── Step indicator ────────────────────────────────────────────────
function Steps({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: total }, (_, i) => (
                <React.Fragment key={i}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${i < current ? 'bg-accent text-accent-text' : i === current ? 'bg-accent text-accent-text ring-4 ring-accent/20' : 'bg-subtle border border-default text-text-placeholder'}`}>
                        {i < current ? <Check size={10} strokeWidth={3} /> : i + 1}
                    </div>
                    {i < total - 1 && (
                        <div className={`flex-1 h-0.5 rounded-full transition-all ${i < current ? 'bg-accent' : 'bg-default'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

// ── Shell ─────────────────────────────────────────────────────────
function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg-app)' }}>
            <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} animate-in fade-in slide-in-from-bottom-3 duration-300`}>
                {/* Logo mark */}
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
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [status, setStatus] = useState<Status>('checking');
    const [error, setError] = useState('');

    // New agency form state
    const [orgName, setOrgName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [jobTitle, setJobTitle] = useState('');

    // Request-access state
    const [reqFirstName, setReqFirstName] = useState('');
    const [reqLastName, setReqLastName] = useState('');
    const [loading, setLoading] = useState(false);

    // ── Auto-detect state on load ─────────────────────────────────
    useEffect(() => {
        if (!session?.user?.email) return;

        const detect = async () => {
            setStatus('checking');

            // Already a known employee? → dashboard
            const alreadyInContext = employees.find(e => e.email === session.user.email);
            if (alreadyInContext) { router.replace('/dashboard'); return; }

            const { data: empRow } = await supabase
                .from('employees').select('id, user_id').eq('email', session.user.email).maybeSingle();

            if (empRow) {
                if (empRow.user_id) { router.replace('/dashboard'); return; }
                // Pre-created via invite → link silently
                setStatus('linking');
                const { data: linked } = await supabase.rpc('link_invited_employee');
                if (linked) { router.replace('/dashboard'); return; }
            }

            // Check for pending / rejected request
            const { data: req } = await supabase
                .from('registration_requests').select('status')
                .eq('email', session.user.email)
                .order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (req?.status === 'pending') { setStatus('submitted'); return; }
            if (req?.status === 'rejected') { setStatus('rejected'); return; }

            setStatus('choice');
        };

        detect();
    }, [session, employees, router]);

    // ── Logo file picker ──────────────────────────────────────────
    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setLogoFile(f);
        setLogoPreview(URL.createObjectURL(f));
    };

    // ── Create new organization ───────────────────────────────────
    const handleCreateOrg = async () => {
        setError('');
        setLoading(true);
        setStatus('creating');

        try {
            const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

            const { data: orgId, error: rpcErr } = await supabase.rpc('create_new_organization', {
                p_org_name: orgName.trim(),
                p_employee_name: fullName,
                p_job_title: jobTitle.trim() || null,
            });

            if (rpcErr) throw new Error(rpcErr.message);

            // Optional: upload logo and set it
            if (logoFile && orgId) {
                try {
                    const logoUrl = await uploadFileToSupabase(logoFile, 'client-logos');
                    await supabase.from('agency_settings')
                        .update({ logo_url: logoUrl })
                        .eq('organization_id', orgId);
                } catch {
                    // Logo upload failure is non-fatal
                }
            }

            router.replace('/dashboard');
        } catch (e: any) {
            setError(e.message || 'Unbekannter Fehler.');
            setStatus('new_step2');
        } finally {
            setLoading(false);
        }
    };

    // ── Request access to existing org ───────────────────────────
    const handleRequestAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user?.email) return;
        setLoading(true);
        setError('');

        const fullName = `${reqFirstName.trim()} ${reqLastName.trim()}`.trim();

        const { data: existing } = await supabase
            .from('registration_requests').select('id').eq('email', session.user.email).maybeSingle();

        const payload = { name: fullName, status: 'pending', organization_id: null as any };
        const { error: dbErr } = existing
            ? await supabase.from('registration_requests').update(payload).eq('id', existing.id)
            : await supabase.from('registration_requests').insert([{ ...payload, email: session.user.email }]);

        if (dbErr) setError(dbErr.message);
        else setStatus('submitted');
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    // ─────────────────────────────────────────────────────────────
    // SCREENS
    // ─────────────────────────────────────────────────────────────

    if (status === 'checking' || status === 'linking' || status === 'creating') {
        const label = status === 'linking' ? 'Einladung wird verknüpft…' : status === 'creating' ? 'Agentur wird angelegt…' : 'Prüfe Status…';
        return (
            <Shell>
                <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 size={32} className="animate-spin text-accent" />
                    <p className="text-sm font-medium text-text-muted">{label}</p>
                </div>
            </Shell>
        );
    }

    // ── Choice ────────────────────────────────────────────────────
    if (status === 'choice') {
        return (
            <Shell>
                <h1 className="text-2xl font-black text-text-primary mb-1">Willkommen</h1>
                <p className="text-text-muted text-sm mb-8">
                    Angemeldet als <span className="font-semibold text-text-secondary">{session?.user?.email}</span>
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => setStatus('new_step1')}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-default hover:border-accent hover:bg-accent/5 transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Building2 size={18} />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-text-primary text-sm">Neue Agentur anlegen</div>
                            <div className="text-xs text-text-muted mt-0.5">Organisation gründen &amp; als Admin starten</div>
                        </div>
                        <ArrowRight size={16} className="text-text-placeholder group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </button>

                    <button
                        onClick={() => setStatus('request_access')}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-default hover:border-default hover:bg-subtle/50 transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-subtle border border-default text-text-secondary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <UserPlus size={18} />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-text-primary text-sm">Bestehender Agentur beitreten</div>
                            <div className="text-xs text-text-muted mt-0.5">Zugang beim Admin anfragen</div>
                        </div>
                        <ArrowRight size={16} className="text-text-placeholder group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                </div>

                <p className="text-center text-xs text-text-placeholder mt-6">
                    Eingeladen? Stelle sicher, dass du mit der E-Mail-Adresse angemeldet bist, an die die Einladung gesendet wurde.
                </p>
                <div className="text-center mt-4">
                    <button onClick={handleLogout} className="text-xs text-text-placeholder hover:text-text-secondary transition">Abmelden</button>
                </div>
            </Shell>
        );
    }

    // ── New Org — Step 1: Agency Details ─────────────────────────
    if (status === 'new_step1') {
        return (
            <Shell>
                <Steps current={0} total={2} />
                <h1 className="text-xl font-black text-text-primary mb-1">Agentur einrichten</h1>
                <p className="text-sm text-text-muted mb-6">Wie heißt deine Agentur?</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Agenturname *</label>
                        <input
                            autoFocus
                            type="text"
                            placeholder="z.B. Studio Müller GmbH"
                            className="w-full p-3 rounded-xl border border-default bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && orgName.trim() && setStatus('new_step2')}
                        />
                    </div>

                    {/* Logo upload — optional */}
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                            Logo <span className="normal-case font-normal text-text-placeholder">(optional — kann später hochgeladen werden)</span>
                        </label>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                        {logoPreview ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-default bg-subtle">
                                <img src={logoPreview} alt="Logo" className="h-10 w-auto max-w-[120px] object-contain rounded-lg" />
                                <span className="text-xs text-text-secondary font-medium flex-1 truncate">{logoFile?.name}</span>
                                <button onClick={() => { setLogoFile(null); setLogoPreview(''); }} className="p-1 text-text-placeholder hover:text-red-500 transition rounded">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => logoInputRef.current?.click()}
                                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-default hover:border-accent hover:bg-accent/5 transition-all group text-left"
                            >
                                <div className="w-8 h-8 rounded-lg bg-subtle border border-default flex items-center justify-center group-hover:border-accent group-hover:text-accent text-text-placeholder transition">
                                    <Upload size={14} />
                                </div>
                                <span className="text-sm text-text-muted group-hover:text-accent transition font-medium">Logo hochladen</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={() => setStatus('choice')} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-default text-sm text-text-secondary hover:bg-hover transition">
                        <ArrowLeft size={14} /> Zurück
                    </button>
                    <button
                        disabled={!orgName.trim()}
                        onClick={() => setStatus('new_step2')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition disabled:opacity-40"
                    >
                        Weiter <ArrowRight size={15} />
                    </button>
                </div>
            </Shell>
        );
    }

    // ── New Org — Step 2: Personal Details ────────────────────────
    if (status === 'new_step2') {
        const canSubmit = firstName.trim() && lastName.trim();
        return (
            <Shell>
                <Steps current={1} total={2} />
                <h1 className="text-xl font-black text-text-primary mb-1">Persönliche Daten</h1>
                <p className="text-sm text-text-muted mb-6">Wie wirst du in der App angezeigt?</p>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Vorname *</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Max"
                                className="w-full p-3 rounded-xl border border-default bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Nachname *</label>
                            <input
                                type="text"
                                placeholder="Mustermann"
                                className="w-full p-3 rounded-xl border border-default bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                            Jobtitel <span className="normal-case font-normal text-text-placeholder">(optional)</span>
                        </label>
                        <input
                            type="text"
                            placeholder="z.B. Geschäftsführer, Creative Director"
                            className="w-full p-3 rounded-xl border border-default bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm"
                            value={jobTitle}
                            onChange={e => setJobTitle(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <div className="rounded-xl bg-subtle border border-default p-4 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                            <span className="text-text-placeholder">Agentur</span>
                            <span className="font-semibold text-text-primary">{orgName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-placeholder">Account</span>
                            <span className="font-semibold text-text-secondary">{session?.user?.email}</span>
                        </div>
                        {logoPreview && (
                            <div className="flex justify-between items-center">
                                <span className="text-text-placeholder">Logo</span>
                                <img src={logoPreview} className="h-5 w-auto object-contain" alt="Logo" />
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={() => setStatus('new_step1')} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-default text-sm text-text-secondary hover:bg-hover transition">
                        <ArrowLeft size={14} /> Zurück
                    </button>
                    <button
                        disabled={!canSubmit || loading}
                        onClick={handleCreateOrg}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition disabled:opacity-40"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                        {loading ? 'Wird erstellt…' : 'Agentur erstellen'}
                    </button>
                </div>
            </Shell>
        );
    }

    // ── Request Access ────────────────────────────────────────────
    if (status === 'request_access') {
        return (
            <Shell>
                <button onClick={() => setStatus('choice')} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition mb-6">
                    <ArrowLeft size={13} /> Zurück
                </button>
                <h1 className="text-xl font-black text-text-primary mb-1">Zugang anfragen</h1>
                <p className="text-sm text-text-muted mb-6">Dein Admin schaltet dich dann in der Software frei.</p>

                <form onSubmit={handleRequestAccess} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Vorname *</label>
                            <input
                                autoFocus required type="text" placeholder="Max"
                                className="w-full p-3 rounded-xl border border-default bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm"
                                value={reqFirstName} onChange={e => setReqFirstName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Nachname *</label>
                            <input
                                required type="text" placeholder="Mustermann"
                                className="w-full p-3 rounded-xl border border-default bg-subtle text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm"
                                value={reqLastName} onChange={e => setReqLastName(e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-text-muted">
                        Angemeldet als: <span className="font-semibold text-text-secondary">{session?.user?.email}</span>
                    </p>
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600">{error}</div>
                    )}
                    <button
                        type="submit"
                        disabled={loading || !reqFirstName.trim() || !reqLastName.trim()}
                        className="w-full py-3 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition disabled:opacity-40"
                    >
                        {loading ? 'Sende…' : 'Zugang anfragen'}
                    </button>
                </form>

                <div className="text-center mt-5">
                    <button onClick={handleLogout} className="text-xs text-text-placeholder hover:text-text-secondary transition">Abmelden</button>
                </div>
            </Shell>
        );
    }

    // ── Submitted ─────────────────────────────────────────────────
    if (status === 'submitted') {
        return (
            <Shell>
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                        <Check size={26} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-text-primary mb-2">Anfrage gesendet</h1>
                        <p className="text-sm text-text-muted max-w-xs">Dein Admin wird dich freischalten. Du erhältst dann automatisch Zugriff.</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full mt-4">
                        <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition">
                            Status neu prüfen
                        </button>
                        <button onClick={handleLogout} className="text-xs text-text-placeholder hover:text-text-secondary transition py-2">Abmelden</button>
                    </div>
                </div>
            </Shell>
        );
    }

    // ── Rejected ──────────────────────────────────────────────────
    if (status === 'rejected') {
        return (
            <Shell>
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                        <X size={26} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-text-primary mb-2">Anfrage abgelehnt</h1>
                        <p className="text-sm text-text-muted max-w-xs">Deine Beitrittsanfrage wurde abgelehnt. Wende dich direkt an einen Admin.</p>
                    </div>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={handleLogout} className="flex-1 py-3 rounded-xl border border-default text-sm text-text-secondary hover:bg-hover transition">Abmelden</button>
                        <button onClick={() => setStatus('request_access')} className="flex-1 py-3 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition">Erneut anfragen</button>
                    </div>
                </div>
            </Shell>
        );
    }

    return null;
}
