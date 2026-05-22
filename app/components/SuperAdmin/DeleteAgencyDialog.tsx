'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { Organization } from '../../types';
import { toast } from 'sonner';
import {
    AlertTriangle, Trash, Archive, Loader2, X, ShieldAlert, Check,
} from 'lucide-react';
import { INPUT_CLS, DangerButton } from './AdminUI';

interface UsageSnapshot {
    employee_count: number;
    project_count: number;
    client_count: number;
    allocation_count: number;
    time_entries_total: number;
}

interface DeleteAgencyDialogProps {
    org: Organization;
    onClose: () => void;
    onDeleted: () => void;
}

type Stage = 'confirm-1' | 'confirm-2' | 'working' | 'done';

export default function DeleteAgencyDialog({ org, onClose, onDeleted }: DeleteAgencyDialogProps) {
    const [mounted, setMounted] = useState(false);
    const [stage, setStage] = useState<Stage>('confirm-1');
    const [usage, setUsage] = useState<UsageSnapshot | null>(null);
    const [typedName, setTypedName] = useState('');
    const [workingLabel, setWorkingLabel] = useState('Erstelle Backup…');
    const [doneBackupId, setDoneBackupId] = useState<string | null>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (stage !== 'confirm-1') return;
        supabase.rpc('get_org_usage_super_admin', { p_org_id: org.id }).then(({ data }) => {
            if (data && data.length > 0) {
                const u = data[0];
                setUsage({
                    employee_count:     Number(u.employee_count)      || 0,
                    project_count:      Number(u.project_count)       || 0,
                    client_count:       Number(u.client_count)        || 0,
                    allocation_count:   Number(u.allocation_count)    || 0,
                    time_entries_total: Number(u.time_entries_total)  || 0,
                });
            }
        });
    }, [org.id, stage]);

    const typedMatches = typedName.trim().toLowerCase() === org.name.trim().toLowerCase();

    const performDelete = async () => {
        setStage('working');
        setWorkingLabel('Erstelle Backup + lösche Daten…');

        const { data, error } = await supabase.rpc('delete_organization_super_admin', { p_org_id: org.id });
        if (error) {
            toast.error('Löschen fehlgeschlagen: ' + error.message);
            setStage('confirm-2');
            return;
        }

        // RPC gibt backup_id zurück
        setDoneBackupId(data as string);
        setStage('done');
        toast.success(`"${org.name}" gelöscht. Backup im System gespeichert.`);
    };

    if (!mounted) return null;

    const overlay = (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={stage === 'working' ? undefined : onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="bg-surface rounded-2xl shadow-lg max-w-lg w-full animate-in zoom-in-95 duration-200"
                style={{ border: '1px solid var(--border-subtle)' }}
            >
                {stage === 'confirm-1' && (
                    <Stage1
                        org={org}
                        usage={usage}
                        onCancel={onClose}
                        onContinue={() => setStage('confirm-2')}
                    />
                )}
                {stage === 'confirm-2' && (
                    <Stage2
                        org={org}
                        typedName={typedName}
                        setTypedName={setTypedName}
                        typedMatches={typedMatches}
                        onBack={() => setStage('confirm-1')}
                        onConfirm={performDelete}
                    />
                )}
                {stage === 'working' && (
                    <StageWorking label={workingLabel} />
                )}
                {stage === 'done' && (
                    <StageDone
                        orgName={org.name}
                        backupId={doneBackupId}
                        onClose={() => { onDeleted(); onClose(); }}
                    />
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}

// ─────────────────────────────────────────────────────────────
// Stage 1 — Übersicht der Konsequenzen
// ─────────────────────────────────────────────────────────────

function Stage1({ org, usage, onCancel, onContinue }: {
    org: Organization;
    usage: UsageSnapshot | null;
    onCancel: () => void;
    onContinue: () => void;
}) {
    return (
        <>
            <div className="flex items-start gap-4 p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)' }}>
                    <Trash size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="ds-title leading-tight mb-1">Agentur löschen?</h3>
                    <p className="ds-callout leading-relaxed">
                        Du bist dabei, <strong>{org.name}</strong> und sämtliche zugehörige Daten zu löschen.
                    </p>
                </div>
                <button onClick={onCancel} className="btn-ghost p-1.5 shrink-0">
                    <X size={16} />
                </button>
            </div>

            <div className="p-5 space-y-4">
                <div>
                    <div className="ds-caption mb-2">Was wird gelöscht</div>
                    {!usage ? (
                        <div className="text-xs text-text-muted italic">Lade Datenmenge…</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <StatTile label="Mitarbeiter"    value={usage.employee_count} />
                            <StatTile label="Projekte"       value={usage.project_count} />
                            <StatTile label="Kunden"         value={usage.client_count} />
                            <StatTile label="Allokationen"   value={usage.allocation_count} />
                            <StatTile label="Zeitbuchungen"  value={usage.time_entries_total} colSpan={2} />
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl" style={{
                    background: 'var(--color-info-subtle)',
                    border: '1px solid var(--color-info-border)',
                    color: 'var(--color-info-text)',
                }}>
                    <Archive size={14} className="mt-0.5 shrink-0" />
                    <div className="text-xs">
                        <div className="font-bold">Backup wird automatisch erstellt</div>
                        <div className="mt-0.5">
                            Wir speichern ein vollständiges Backup in der Datenbank, bevor wir löschen.
                            Du findest es jederzeit unter <strong>Backups</strong> und kannst von dort
                            wiederherstellen oder als JSON herunterladen.
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl" style={{
                    background: 'var(--color-danger-subtle)',
                    border: '1px solid var(--color-danger-border)',
                    color: 'var(--color-danger-text)',
                }}>
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <div className="text-xs">
                        <div className="font-bold">Direkt nach dem Löschen</div>
                        <div className="mt-0.5">
                            Mitarbeiter können sich nicht mehr einloggen. Restore aus Backup ist
                            jederzeit möglich, solange das Backup nicht gelöscht wurde.
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={onCancel} className="btn-ghost px-4 py-2 rounded-xl">
                    Abbrechen
                </button>
                <DangerButton onClick={onContinue}>
                    Weiter zur Bestätigung
                </DangerButton>
            </div>
        </>
    );
}

function StatTile({ label, value, colSpan }: { label: string; value: number; colSpan?: number }) {
    return (
        <div className="p-3 rounded-xl"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</div>
            <div className="text-lg font-bold text-text-primary mt-0.5">{value.toLocaleString('de-DE')}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Stage 2 — Name eintippen
// ─────────────────────────────────────────────────────────────

function Stage2({ org, typedName, setTypedName, typedMatches, onBack, onConfirm }: {
    org: Organization;
    typedName: string;
    setTypedName: (s: string) => void;
    typedMatches: boolean;
    onBack: () => void;
    onConfirm: () => void;
}) {
    return (
        <>
            <div className="flex items-start gap-4 p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)' }}>
                    <ShieldAlert size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="ds-title leading-tight mb-1">Bist du dir sicher?</h3>
                    <p className="ds-callout leading-relaxed">
                        Tippe den Agentur-Namen exakt ein, um die Löschung zu autorisieren.
                    </p>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-text-muted">
                        Agentur-Name zur Bestätigung
                    </label>
                    <div className="mb-2 text-[13px] font-mono px-3 py-2 rounded-lg"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px dashed var(--border-default)' }}>
                        {org.name}
                    </div>
                    <input
                        type="text"
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                        placeholder="Tippe den Namen exakt ab…"
                        className={INPUT_CLS}
                        autoFocus
                    />
                    <div className="mt-1.5 text-[11px] flex items-center gap-1.5"
                        style={{ color: typedMatches ? 'var(--color-success-text)' : 'var(--text-muted)' }}>
                        {typedMatches ? (
                            <><Check size={11} /> Name stimmt überein</>
                        ) : (
                            <>Groß-/Kleinschreibung wird ignoriert</>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={onBack} className="btn-ghost px-4 py-2 rounded-xl">
                    Zurück
                </button>
                <DangerButton onClick={onConfirm} disabled={!typedMatches}>
                    <Trash size={14} /> Endgültig löschen
                </DangerButton>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────
// Working / Done
// ─────────────────────────────────────────────────────────────

function StageWorking({ label }: { label: string }) {
    return (
        <div className="p-10 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                <Loader2 size={20} className="animate-spin" />
            </div>
            <h3 className="ds-title">{label}</h3>
        </div>
    );
}

function StageDone({ orgName, backupId, onClose }: {
    orgName: string;
    backupId: string | null;
    onClose: () => void;
}) {
    return (
        <>
            <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success-text)' }}>
                    <Check size={20} />
                </div>
                <div>
                    <h3 className="ds-title mb-1">Erfolgreich gelöscht</h3>
                    <p className="ds-callout">
                        <strong>{orgName}</strong> wurde entfernt. Das Backup liegt im System.
                    </p>
                </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={onClose} className="btn-ghost px-4 py-2 rounded-xl">
                    Schließen
                </button>
                <Link
                    href="/admin/backups"
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm active:scale-[0.98]"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                >
                    <Archive size={14} /> Zu den Backups
                </Link>
            </div>
        </>
    );
}
