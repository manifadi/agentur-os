'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../supabaseClient';
import { OrganizationPlan } from '../../../types';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Building2, UserPlus, Check, Loader2 } from 'lucide-react';
import {
    SectionHeader, Card, Field, INPUT_CLS, PrimaryButton, SecondaryButton,
} from '../../../components/SuperAdmin/AdminUI';

const PLANS: { value: OrganizationPlan; label: string; sub: string; defaults: { max_employees: number | null; max_projects: number | null } }[] = [
    { value: 'trial',    label: 'Trial',    sub: '30 Tage kostenlos',     defaults: { max_employees: 5,  max_projects: 10 } },
    { value: 'pro',      label: 'Pro',      sub: 'Kleine Agenturen',      defaults: { max_employees: 15, max_projects: 50 } },
    { value: 'agency',   label: 'Agency',   sub: 'Mittlere Agenturen',    defaults: { max_employees: 50, max_projects: 200 } },
    { value: 'internal', label: 'Intern',   sub: 'Eigene Test-Agentur',   defaults: { max_employees: null, max_projects: null } },
];

const INDUSTRIES = ['Werbeagentur', 'Designstudio', 'Filmproduktion', 'Markenagentur', 'Digitalagentur', 'PR-Agentur', 'Sonstige'];

function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewAgencyWizard() {
    const router = useRouter();

    const [step, setStep] = useState<1 | 2>(1);
    const [submitting, setSubmitting] = useState(false);

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [industry, setIndustry] = useState('Werbeagentur');
    const [plan, setPlan] = useState<OrganizationPlan>('trial');
    const [maxEmp, setMaxEmp] = useState<string>('5');
    const [maxProj, setMaxProj] = useState<string>('10');
    const [trialDays, setTrialDays] = useState<string>('30');
    const [notes, setNotes] = useState('');

    const [ownerName, setOwnerName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [sendOwnerInvite, setSendOwnerInvite] = useState(true);
    const [extraEmails, setExtraEmails] = useState('');

    const handleNameChange = (v: string) => {
        setName(v);
        if (!slugTouched) setSlug(slugify(v));
    };

    const handlePlanChange = (p: OrganizationPlan) => {
        setPlan(p);
        const def = PLANS.find(x => x.value === p)?.defaults;
        if (def) {
            setMaxEmp(def.max_employees === null ? '' : String(def.max_employees));
            setMaxProj(def.max_projects === null ? '' : String(def.max_projects));
        }
    };

    const step1Valid = name.trim().length >= 2;
    const step2Valid = ownerEmail.includes('@');

    const handleSubmit = async () => {
        setSubmitting(true);

        const { data, error } = await supabase.rpc('create_organization_with_owner', {
            p_name:           name.trim(),
            p_slug:           slug.trim() || null,
            p_industry:       industry || null,
            p_plan:           plan,
            p_max_employees:  maxEmp === '' ? null : parseInt(maxEmp, 10),
            p_max_projects:   maxProj === '' ? null : parseInt(maxProj, 10),
            p_notes:          notes.trim() || null,
            p_owner_name:     ownerName.trim() || null,
            p_owner_email:    ownerEmail.trim() || null,
            p_trial_days:     parseInt(trialDays, 10) || 30,
        });

        if (error || !data) {
            toast.error('Fehler beim Anlegen: ' + (error?.message || 'unbekannt'));
            setSubmitting(false);
            return;
        }

        const orgId: string = (data as any).org_id;

        if (sendOwnerInvite && ownerEmail.trim()) {
            const { error: inviteErr } = await supabase.auth.signInWithOtp({
                email: ownerEmail.trim(),
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            if (inviteErr) toast.warning('Agentur angelegt, aber Owner-Mail fehlgeschlagen: ' + inviteErr.message);
        }

        const extras = extraEmails.split(/[,\n]/).map(e => e.trim()).filter(e => e.includes('@'));
        for (const email of extras) {
            const { error: empErr } = await supabase.rpc('invite_employee_to_org', {
                p_org_id: orgId,
                p_name:   email.split('@')[0],
                p_email:  email,
                p_role:   'user',
            });
            if (!empErr) {
                await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                });
            }
        }

        toast.success(`Agentur "${name}" erfolgreich angelegt.`);
        router.push(`/admin/agencies/${orgId}`);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <Link
                href="/admin/agencies"
                className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition font-medium"
            >
                <ArrowLeft size={14} /> Zurück
            </Link>

            <SectionHeader
                title="Neue Agentur anlegen"
                subtitle={`Schritt ${step} von 2 — ${step === 1 ? 'Stammdaten' : 'Owner & Einladungen'}`}
            />

            {/* Progress */}
            <div className="flex gap-2">
                <div className="h-1 flex-1 rounded-full transition-all" style={{ background: 'var(--accent)' }} />
                <div className="h-1 flex-1 rounded-full transition-all" style={{ background: step >= 2 ? 'var(--accent)' : 'var(--bg-subtle)' }} />
            </div>

            {/* Step 1 — Stammdaten */}
            {step === 1 && (
                <Card>
                    <div className="flex items-center gap-2.5 pb-4 mb-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <div className="card-header-icon"><Building2 size={14} /></div>
                        <span className="text-sm font-bold text-text-primary">Stammdaten</span>
                    </div>

                    <div className="space-y-5">
                        <Field label="Agentur-Name *">
                            <input type="text" value={name} onChange={e => handleNameChange(e.target.value)}
                                placeholder="z.B. Pilotagentur GmbH" className={INPUT_CLS} />
                        </Field>

                        <Field label="Slug" hint="für spätere Subdomain: meine-agentur.agentur-os.de">
                            <input type="text" value={slug}
                                onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                                placeholder="pilotagentur" className={INPUT_CLS + ' font-mono'} />
                        </Field>

                        <Field label="Branche">
                            <select value={industry} onChange={e => setIndustry(e.target.value)} className={INPUT_CLS}>
                                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </Field>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-text-muted">Plan</label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {PLANS.map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => handlePlanChange(p.value)}
                                        className="text-left p-3.5 rounded-xl transition"
                                        style={plan === p.value ? {
                                            border: '1.5px solid var(--accent)',
                                            background: 'var(--accent-subtle)',
                                        } : {
                                            border: '1.5px solid var(--border-default)',
                                            background: 'var(--bg-subtle)',
                                        }}
                                    >
                                        <div className="font-semibold text-sm text-text-primary mb-0.5">{p.label}</div>
                                        <div className="text-[11px] text-text-muted">{p.sub}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {plan === 'trial' && (
                            <Field label="Trial-Tage" hint="Wie lange läuft der Test?">
                                <input type="number" min={1} max={365} value={trialDays}
                                    onChange={e => setTrialDays(e.target.value)}
                                    className={INPUT_CLS + ' max-w-[120px]'} />
                            </Field>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Max. Mitarbeiter" hint="leer = unbegrenzt">
                                <input type="number" min={1} value={maxEmp}
                                    onChange={e => setMaxEmp(e.target.value)}
                                    placeholder="unbegrenzt" className={INPUT_CLS} />
                            </Field>
                            <Field label="Max. Projekte" hint="leer = unbegrenzt">
                                <input type="number" min={1} value={maxProj}
                                    onChange={e => setMaxProj(e.target.value)}
                                    placeholder="unbegrenzt" className={INPUT_CLS} />
                            </Field>
                        </div>

                        <Field label="Interne Notiz" hint="Nur Super-Admin sieht das">
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                                placeholder="z.B. 'Pilot-Kunde Anfang Juni — Feedback-Calls jeden Freitag'"
                                className={INPUT_CLS} />
                        </Field>
                    </div>

                    <div className="flex justify-end pt-5 mt-5" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <PrimaryButton onClick={() => setStep(2)} disabled={!step1Valid}>
                            Weiter <ArrowRight size={14} />
                        </PrimaryButton>
                    </div>
                </Card>
            )}

            {/* Step 2 — Owner */}
            {step === 2 && (
                <Card>
                    <div className="flex items-center gap-2.5 pb-4 mb-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <div className="card-header-icon"><UserPlus size={14} /></div>
                        <span className="text-sm font-bold text-text-primary">Owner-Account</span>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Owner Name">
                                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                                    placeholder="Max Muster" className={INPUT_CLS} />
                            </Field>
                            <Field label="Owner E-Mail *">
                                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
                                    placeholder="max@agentur.de" className={INPUT_CLS} />
                            </Field>
                        </div>

                        <label className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition"
                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                            <input
                                type="checkbox"
                                checked={sendOwnerInvite}
                                onChange={e => setSendOwnerInvite(e.target.checked)}
                                className="mt-0.5 accent-text-primary"
                            />
                            <div>
                                <div className="font-semibold text-sm text-text-primary">Magic-Link-Einladung an Owner senden</div>
                                <div className="text-xs text-text-muted mt-0.5">
                                    Owner kann sich beim ersten Login direkt per Mail-Link anmelden, ohne Passwort.
                                </div>
                            </div>
                        </label>

                        <div style={{ borderTop: '1px solid var(--border-default)' }} className="pt-5">
                            <Field label="Weitere Mitarbeiter (optional)" hint="Eine E-Mail pro Zeile oder kommagetrennt — alle werden als 'Mitarbeiter' angelegt.">
                                <textarea value={extraEmails} onChange={e => setExtraEmails(e.target.value)} rows={4}
                                    placeholder={'kollege1@agentur.de\nkollege2@agentur.de'}
                                    className={INPUT_CLS} />
                            </Field>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-5 mt-5" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <SecondaryButton onClick={() => setStep(1)} disabled={submitting}>
                            <ArrowLeft size={14} /> Zurück
                        </SecondaryButton>

                        <PrimaryButton onClick={handleSubmit} disabled={!step2Valid || submitting}>
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {submitting ? 'Lege an…' : 'Agentur anlegen'}
                        </PrimaryButton>
                    </div>
                </Card>
            )}
        </div>
    );
}
