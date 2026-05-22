'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import {
    Upload, FileJson, X, Loader2, Check, AlertTriangle, ArrowUp, Building2,
    Archive, Search,
} from 'lucide-react';
import { PrimaryButton, INPUT_CLS } from './AdminUI';
import { useSuperAdmin, AgencyBackup } from './SuperAdminContext';

interface PeekResult {
    org_id: string;
    org_name: string;
    org_plan: string;
    exported_at: string;
    exported_by: string;
    already_exists: boolean;
    counts: {
        employees: number;
        clients: number;
        projects: number;
        todos: number;
        allocations: number;
        time_entries: number;
        departments: number;
        positions: number;
        calendar_events: number;
    };
}

type Source = 'db' | 'file';
type Stage = 'select-source' | 'pick-backup' | 'pick-file' | 'preview' | 'working' | 'done';

interface RestoreAgencyDialogProps {
    onClose: () => void;
}

function fmtBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function RestoreAgencyDialog({ onClose }: RestoreAgencyDialogProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);

    const { backups } = useSuperAdmin();

    const [stage, setStage] = useState<Stage>('select-source');
    const [source, setSource] = useState<Source>('db');
    const [dragOver, setDragOver] = useState(false);
    const [query, setQuery] = useState('');

    const [chosenBackupId, setChosenBackupId] = useState<string | null>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [backupJson, setBackupJson] = useState<any | null>(null);
    const [peek, setPeek] = useState<PeekResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [doneInfo, setDoneInfo] = useState<{ org_id: string; org_name: string } | null>(null);

    useEffect(() => { setMounted(true); }, []);

    const restorable = useMemo(
        () => backups.filter(b => !b.org_still_exists),
        [backups],
    );
    const filtered = useMemo(
        () => restorable.filter(b => !query || b.org_name.toLowerCase().includes(query.toLowerCase())),
        [restorable, query],
    );

    // Wenn der User "Aus Backup-Liste" wählt
    const goToBackupList = () => {
        setSource('db');
        setStage('pick-backup');
    };

    const goToFileUpload = () => {
        setSource('file');
        setStage('pick-file');
    };

    // DB-Backup auswählen → direkt zu Preview
    const pickDbBackup = async (b: AgencyBackup) => {
        setChosenBackupId(b.id);
        setError(null);
        const { data, error: getErr } = await supabase.rpc('get_agency_backup_super_admin', { p_backup_id: b.id });
        if (getErr || !data) {
            setError(getErr?.message || 'Konnte Backup nicht laden.');
            return;
        }
        setBackupJson(data);
        const { data: peekData, error: peekErr } = await supabase.rpc('peek_backup_super_admin', { p_backup: data });
        if (peekErr) {
            setError(peekErr.message);
            return;
        }
        setPeek(peekData as PeekResult);
        setStage('preview');
    };

    // Datei-Upload
    const handleFile = async (file: File) => {
        setError(null);
        if (!file.name.endsWith('.json')) {
            setError('Bitte eine .json-Datei wählen.');
            return;
        }
        setFilename(file.name);

        let parsed: any;
        try {
            const text = await file.text();
            parsed = JSON.parse(text);
        } catch {
            setError('Datei ist kein gültiges JSON.');
            return;
        }
        setBackupJson(parsed);

        const { data, error: peekErr } = await supabase.rpc('peek_backup_super_admin', { p_backup: parsed });
        if (peekErr) {
            setError(peekErr.message);
            return;
        }
        setPeek(data as PeekResult);
        setStage('preview');
    };

    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await handleFile(file);
    };

    const performRestore = async () => {
        setStage('working');

        // DB-Backup: nimm restore_agency_backup_from_db (schreibt zusätzlichen Audit-Eintrag)
        // File-Upload: restore_organization_from_backup direkt
        let result: any, err: any;
        if (source === 'db' && chosenBackupId) {
            ({ data: result, error: err } = await supabase.rpc('restore_agency_backup_from_db', { p_backup_id: chosenBackupId }));
        } else if (backupJson) {
            ({ data: result, error: err } = await supabase.rpc('restore_organization_from_backup', { p_backup: backupJson }));
        }

        if (err) {
            toast.error('Restore fehlgeschlagen: ' + err.message);
            setStage('preview');
            return;
        }

        setDoneInfo({
            org_id: result.org_id,
            org_name: result.org_name,
        });
        setStage('done');
        toast.success(`"${result.org_name}" wurde wiederhergestellt.`);
    };

    const goToAgency = () => {
        if (doneInfo) router.push(`/admin/agencies/${doneInfo.org_id}`);
        onClose();
    };

    if (!mounted) return null;

    const overlay = (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={stage === 'working' ? undefined : onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="bg-surface rounded-2xl shadow-lg max-w-2xl w-full animate-in zoom-in-95 duration-200"
                style={{ border: '1px solid var(--border-subtle)' }}
            >
                {/* Header */}
                <div className="flex items-start gap-4 p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info-text)' }}>
                        <ArrowUp size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="ds-title leading-tight mb-1">Agentur wiederherstellen</h3>
                        <p className="ds-callout leading-relaxed">
                            {stage === 'select-source' && 'Wähle eine Backup-Quelle.'}
                            {stage === 'pick-backup' && `${restorable.length} verfügbares Backup${restorable.length === 1 ? '' : 's'} im System.`}
                            {stage === 'pick-file' && 'JSON-Datei vom Rechner hochladen.'}
                            {stage === 'preview' && 'Prüfe die Daten, bevor du wiederherstellst.'}
                            {stage === 'working' && 'Stelle wieder her…'}
                            {stage === 'done' && 'Erfolgreich wiederhergestellt.'}
                        </p>
                    </div>
                    {stage !== 'working' && (
                        <button onClick={onClose} className="btn-ghost p-1.5 shrink-0">
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-5">
                    {stage === 'select-source' && (
                        <div className="grid grid-cols-2 gap-3">
                            <SourceCard
                                icon={Archive}
                                title="Aus Backup-Liste"
                                subtitle={`${restorable.length} verfügbar`}
                                onClick={goToBackupList}
                            />
                            <SourceCard
                                icon={FileJson}
                                title="JSON-Datei hochladen"
                                subtitle="Externes Backup einspielen"
                                onClick={goToFileUpload}
                            />
                        </div>
                    )}

                    {stage === 'pick-backup' && (
                        <div className="space-y-3">
                            {restorable.length > 0 && (
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Suche nach Agentur-Name…"
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        className={INPUT_CLS + ' pl-9'}
                                    />
                                </div>
                            )}

                            {restorable.length === 0 ? (
                                <div className="text-sm text-text-muted italic py-8 text-center">
                                    Keine Backups verfügbar zum Wiederherstellen.
                                    <br /><span className="text-[11px]">(Backups deren Agentur noch existiert werden hier nicht angezeigt.)</span>
                                </div>
                            ) : (
                                <div className="max-h-80 overflow-y-auto space-y-1">
                                    {filtered.map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => pickDbBackup(b)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition hover:bg-hover"
                                        >
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                                                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                                {b.org_name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-text-primary truncate">{b.org_name}</div>
                                                <div className="text-[11px] text-text-muted">
                                                    {new Date(b.created_at).toLocaleString('de-DE')} · {b.employee_count} MA · {b.project_count} Projekte · {fmtBytes(b.size_bytes)}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {stage === 'pick-file' && (
                        <>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="rounded-xl p-8 text-center cursor-pointer transition"
                                style={{
                                    border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
                                    background: dragOver ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                }}
                            >
                                <FileJson size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                <div className="text-sm font-semibold text-text-primary mb-1">
                                    JSON-Backup hierher ziehen
                                </div>
                                <div className="text-xs text-text-muted">oder klicken zum Auswählen</div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json,application/json"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFile(file);
                                    }}
                                />
                            </div>
                            {error && (
                                <div className="mt-4 flex items-start gap-3 p-3 rounded-xl" style={{
                                    background: 'var(--color-danger-subtle)',
                                    color: 'var(--color-danger-text)',
                                    border: '1px solid var(--color-danger-border)',
                                }}>
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <div className="text-xs">
                                        <div className="font-bold">Fehler</div>
                                        <div className="mt-0.5">{error}</div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {stage === 'preview' && peek && (
                        <div className="space-y-4">
                            {source === 'file' && filename && (
                                <div className="flex items-center gap-3 p-3 rounded-xl"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                    <FileJson size={16} className="text-text-muted" />
                                    <div className="text-xs text-text-secondary truncate flex-1">{filename}</div>
                                </div>
                            )}

                            <div>
                                <div className="ds-caption mb-2">Agentur</div>
                                <div className="p-3 rounded-xl"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                                            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                            {peek.org_name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-text-primary">{peek.org_name}</div>
                                            <div className="text-[11px] text-text-muted">
                                                Plan: {peek.org_plan} · Exportiert {new Date(peek.exported_at).toLocaleString('de-DE')} von {peek.exported_by}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {peek.already_exists && (
                                <div className="flex items-start gap-3 p-3 rounded-xl" style={{
                                    background: 'var(--color-danger-subtle)',
                                    color: 'var(--color-danger-text)',
                                    border: '1px solid var(--color-danger-border)',
                                }}>
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <div className="text-xs">
                                        <div className="font-bold">Agentur existiert bereits</div>
                                        <div className="mt-0.5">
                                            Lösche zuerst die bestehende Agentur, dann kannst du restoren.
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="ds-caption mb-2">Was wird wiederhergestellt</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <CountTile label="Mitarbeiter"    value={peek.counts.employees} />
                                    <CountTile label="Kunden"         value={peek.counts.clients} />
                                    <CountTile label="Projekte"       value={peek.counts.projects} />
                                    <CountTile label="Aufgaben"       value={peek.counts.todos} />
                                    <CountTile label="Allokationen"   value={peek.counts.allocations} />
                                    <CountTile label="Zeitbuchungen"  value={peek.counts.time_entries} />
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl" style={{
                                background: 'var(--color-warning-subtle)',
                                color: 'var(--color-warning-text)',
                                border: '1px solid var(--color-warning-border)',
                            }}>
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <div className="text-xs">
                                    <div className="font-bold">Was du wissen solltest</div>
                                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                                        <li>Mitarbeiter müssen sich beim ersten Login neu per Magic-Link verknüpfen</li>
                                        <li>Kalender-OAuth-Tokens sind eventuell abgelaufen → neu verbinden</li>
                                        <li>Die ursprünglichen UUIDs werden wiederverwendet</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {stage === 'working' && (
                        <div className="py-8 text-center space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
                                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                                <Loader2 size={20} className="animate-spin" />
                            </div>
                            <div className="ds-title">Stelle Agentur wieder her…</div>
                            <p className="text-xs text-text-muted">
                                Bei großen Backups kann das einen Moment dauern.
                            </p>
                        </div>
                    )}

                    {stage === 'done' && doneInfo && (
                        <div className="py-6 text-center space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
                                style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success-text)' }}>
                                <Check size={20} />
                            </div>
                            <div>
                                <h3 className="ds-title mb-1">Erfolgreich wiederhergestellt</h3>
                                <p className="ds-callout">
                                    <strong>{doneInfo.org_name}</strong> ist wieder im System.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {stage === 'pick-backup' && (
                    <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <button onClick={() => setStage('select-source')} className="btn-ghost px-4 py-2 rounded-xl">
                            Zurück
                        </button>
                    </div>
                )}

                {stage === 'pick-file' && (
                    <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <button onClick={() => setStage('select-source')} className="btn-ghost px-4 py-2 rounded-xl">
                            Zurück
                        </button>
                    </div>
                )}

                {stage === 'preview' && peek && (
                    <div className="flex justify-between gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <button
                            onClick={() => {
                                setBackupJson(null); setPeek(null);
                                setStage(source === 'db' ? 'pick-backup' : 'pick-file');
                            }}
                            className="btn-ghost px-4 py-2 rounded-xl"
                        >
                            Zurück
                        </button>
                        <PrimaryButton onClick={performRestore} disabled={peek.already_exists}>
                            <ArrowUp size={14} /> Wiederherstellen
                        </PrimaryButton>
                    </div>
                )}

                {stage === 'done' && (
                    <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <button onClick={onClose} className="btn-ghost px-4 py-2 rounded-xl">
                            Schließen
                        </button>
                        <PrimaryButton onClick={goToAgency}>
                            <Building2 size={14} /> Zur Agentur
                        </PrimaryButton>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}

function SourceCard({ icon: Icon, title, subtitle, onClick }: {
    icon: any; title: string; subtitle: string; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="text-left p-5 rounded-2xl transition-all hover:scale-[1.02]"
            style={{
                background: 'var(--bg-subtle)',
                border: '1.5px solid var(--border-default)',
            }}
        >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                <Icon size={18} />
            </div>
            <div className="font-semibold text-sm text-text-primary mb-1">{title}</div>
            <div className="text-xs text-text-muted">{subtitle}</div>
        </button>
    );
}

function CountTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="p-2.5 rounded-xl"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</div>
            <div className="text-base font-bold text-text-primary mt-0.5">{value.toLocaleString('de-DE')}</div>
        </div>
    );
}
