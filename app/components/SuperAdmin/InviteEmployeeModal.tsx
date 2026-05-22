'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { X, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { Field, INPUT_CLS, PrimaryButton } from './AdminUI';

interface InviteEmployeeModalProps {
    orgId: string;
    orgName: string;
    currentCount: number;
    maxAllowed?: number | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function InviteEmployeeModal({
    orgId, orgName, currentCount, maxAllowed, onClose, onSuccess,
}: InviteEmployeeModalProps) {
    const [mounted, setMounted] = useState(false);
    const [name, setName]   = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole]   = useState<'admin' | 'user'>('user');
    const [sendMagicLink, setSendMagicLink] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const atLimit = maxAllowed != null && currentCount >= maxAllowed;
    const isValid = email.includes('@') && !atLimit;

    const handleSubmit = async () => {
        if (!isValid) return;
        setSubmitting(true);

        const { error } = await supabase.rpc('invite_employee_to_org', {
            p_org_id: orgId,
            p_name:   name.trim() || email.split('@')[0],
            p_email:  email.trim(),
            p_role:   role,
        });

        if (error) {
            toast.error('Fehler: ' + error.message);
            setSubmitting(false);
            return;
        }

        if (sendMagicLink) {
            const { error: linkErr } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            if (linkErr) toast.warning('Mitarbeiter angelegt, aber Mail fehlgeschlagen: ' + linkErr.message);
            else toast.success(`Magic-Link an ${email.trim()} verschickt.`);
        } else {
            toast.success(`Mitarbeiter ${email.trim()} angelegt.`);
        }

        onSuccess();
        onClose();
    };

    if (!mounted) return null;

    const overlay = (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="bg-surface rounded-2xl shadow-lg max-w-md w-full animate-in zoom-in-95 duration-200"
                style={{ border: '1px solid var(--border-subtle)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-3">
                        <div className="card-header-icon"><UserPlus size={14} /></div>
                        <div>
                            <h3 className="ds-title leading-tight">Mitarbeiter einladen</h3>
                            <p className="text-xs text-text-secondary">{orgName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-ghost p-1.5">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {atLimit && (
                        <div className="flex items-start gap-3 p-3 rounded-xl" style={{
                            background: 'var(--color-danger-subtle)',
                            color: 'var(--color-danger-text)',
                            border: '1px solid var(--color-danger-border)',
                        }}>
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            <div className="text-xs">
                                <div className="font-bold">Mitarbeiter-Limit erreicht</div>
                                <div className="mt-0.5">
                                    {currentCount} von {maxAllowed} Plätzen belegt. Erhöhe das Limit in den Stammdaten,
                                    um weitere Mitarbeiter hinzuzufügen.
                                </div>
                            </div>
                        </div>
                    )}

                    {!atLimit && maxAllowed != null && (
                        <div className="text-[11px] text-text-muted">
                            Belegung: <span className="font-semibold text-text-secondary">{currentCount} / {maxAllowed}</span>
                        </div>
                    )}

                    <Field label="Name (optional)">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={atLimit}
                            placeholder="Max Muster"
                            className={INPUT_CLS}
                        />
                    </Field>

                    <Field label="E-Mail *">
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={atLimit}
                            placeholder="max@agentur.de"
                            className={INPUT_CLS}
                            autoFocus
                        />
                    </Field>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-text-muted">Rolle</label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { value: 'user',  label: 'Mitarbeiter', sub: 'Standard-Zugriff' },
                                { value: 'admin', label: 'Admin',       sub: 'Volle Agentur-Rechte' },
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setRole(opt.value)}
                                    disabled={atLimit}
                                    className="text-left p-3 rounded-xl transition disabled:opacity-50"
                                    style={role === opt.value ? {
                                        border: '1.5px solid var(--accent)',
                                        background: 'var(--accent-subtle)',
                                    } : {
                                        border: '1.5px solid var(--border-default)',
                                        background: 'var(--bg-subtle)',
                                    }}
                                >
                                    <div className="font-semibold text-xs text-text-primary">{opt.label}</div>
                                    <div className="text-[10px] text-text-muted mt-0.5">{opt.sub}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                        <input
                            type="checkbox"
                            checked={sendMagicLink}
                            onChange={e => setSendMagicLink(e.target.checked)}
                            disabled={atLimit}
                            className="mt-0.5 accent-text-primary"
                        />
                        <div>
                            <div className="font-semibold text-xs text-text-primary">Magic-Link-Mail jetzt senden</div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                                Mitarbeiter erhält Login-Link per E-Mail.
                            </div>
                        </div>
                    </label>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button onClick={onClose} disabled={submitting} className="btn-ghost px-4 py-2 rounded-xl">
                        Abbrechen
                    </button>
                    <PrimaryButton onClick={handleSubmit} disabled={!isValid || submitting}>
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        {submitting ? 'Sende…' : 'Einladen'}
                    </PrimaryButton>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}
