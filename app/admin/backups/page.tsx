'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import {
    Archive, Search, Download, ArrowUp, Trash, Check, Loader2, ShieldAlert,
} from 'lucide-react';
import {
    SectionHeader, Card, EmptyState, INPUT_CLS,
} from '../../components/SuperAdmin/AdminUI';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { useSuperAdmin, AgencyBackup } from '../../components/SuperAdmin/SuperAdminContext';

const REASON_LABEL: Record<string, string> = {
    pre_delete: 'Vor Löschung',
    manual:     'Manuell',
    pre_restore: 'Vor Restore',
};

function fmtBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupsPage() {
    const router = useRouter();
    const { backups, loading } = useSuperAdmin();
    const [query, setQuery] = useState('');
    const [working, setWorking] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<AgencyBackup | null>(null);
    const [confirmRestore, setConfirmRestore] = useState<AgencyBackup | null>(null);

    const filtered = useMemo(() => backups.filter(b => {
        if (!query) return true;
        const hay = `${b.org_name} ${b.created_by_email || ''} ${b.reason}`.toLowerCase();
        return hay.includes(query.toLowerCase());
    }), [backups, query]);

    const handleDownload = async (b: AgencyBackup) => {
        setWorking(b.id);
        const { data, error } = await supabase.rpc('get_agency_backup_super_admin', { p_backup_id: b.id });
        setWorking(null);
        if (error || !data) { toast.error('Download fehlgeschlagen: ' + (error?.message || 'unbekannt')); return; }

        const stamp = new Date(b.created_at).toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const safeName = b.org_name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
        const filename = `agentur-os_backup_${safeName}_${stamp}.json`;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Backup heruntergeladen.');
    };

    const handleRestore = async () => {
        if (!confirmRestore) return;
        const b = confirmRestore;
        setConfirmRestore(null);
        setWorking(b.id);
        const { data, error } = await supabase.rpc('restore_agency_backup_from_db', { p_backup_id: b.id });
        setWorking(null);
        if (error) { toast.error('Restore fehlgeschlagen: ' + error.message); return; }

        toast.success(`"${b.org_name}" wurde wiederhergestellt.`);
        const orgId = (data as any).org_id;
        if (orgId) router.push(`/admin/agencies/${orgId}`);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const b = confirmDelete;
        setConfirmDelete(null);
        setWorking(b.id);
        const { error } = await supabase.rpc('delete_agency_backup_super_admin', { p_backup_id: b.id });
        setWorking(null);
        if (error) { toast.error('Löschen fehlgeschlagen: ' + error.message); return; }
        toast.success(`Backup gelöscht.`);
    };

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Backups"
                subtitle={`${backups.length} Backup${backups.length === 1 ? '' : 's'} im System. Vor jedem Löschen wird automatisch eines erstellt.`}
            />

            <Card padded={false}>
                <div className="p-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Suche nach Agentur-Name, Akteur, Grund…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className={INPUT_CLS + ' pl-9'}
                        />
                    </div>
                </div>
            </Card>

            {loading ? (
                <div className="text-sm text-text-muted italic py-12 text-center">Lade Backups…</div>
            ) : filtered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Archive}
                        title={backups.length === 0 ? 'Noch keine Backups' : 'Keine Treffer'}
                        subtitle={backups.length === 0
                            ? 'Backups werden automatisch erstellt, wenn du eine Agentur löschst oder einen Export auslöst.'
                            : 'Versuche eine andere Suche.'}
                    />
                </Card>
            ) : (
                <Card padded={false}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Agentur</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Grund</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Erstellt</span></th>
                                <th className="text-right px-5 py-3"><span className="ds-caption">Inhalt</span></th>
                                <th className="text-right px-5 py-3"><span className="ds-caption">Größe</span></th>
                                <th className="text-right px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(b => {
                                const busy = working === b.id;
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                        className="hover:bg-hover transition">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                                                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                                    {b.org_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-text-primary">{b.org_name}</div>
                                                    <div className="text-[11px] text-text-muted">
                                                        {b.org_plan} ·{' '}
                                                        {b.org_still_exists
                                                            ? <span style={{ color: 'var(--color-success-text)' }}>Existiert noch</span>
                                                            : <span style={{ color: 'var(--color-warning-text)' }}>Gelöscht</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="badge badge-default">{REASON_LABEL[b.reason] || b.reason}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-xs text-text-secondary">
                                                {new Date(b.created_at).toLocaleString('de-DE')}
                                            </div>
                                            {b.created_by_email && (
                                                <div className="text-[11px] text-text-muted">{b.created_by_email}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-right text-xs">
                                            <span className="text-text-secondary">{b.employee_count} MA</span>
                                            <span className="text-text-muted"> · </span>
                                            <span className="text-text-secondary">{b.project_count} Projekte</span>
                                        </td>
                                        <td className="px-5 py-4 text-right text-xs text-text-muted">
                                            {fmtBytes(b.size_bytes)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleDownload(b)}
                                                    disabled={busy}
                                                    className="btn-ghost p-2"
                                                    title="Als JSON herunterladen"
                                                >
                                                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmRestore(b)}
                                                    disabled={busy || b.org_still_exists}
                                                    className="btn-ghost p-2"
                                                    title={b.org_still_exists
                                                        ? 'Agentur existiert noch — Restore nicht möglich'
                                                        : 'Agentur wiederherstellen'}
                                                    style={{ color: b.org_still_exists ? undefined : 'var(--color-success-text)' }}
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(b)}
                                                    disabled={busy}
                                                    className="btn-ghost p-2"
                                                    style={{ color: 'var(--color-danger-text)' }}
                                                    title="Backup löschen"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            )}

            {confirmRestore && (
                <ConfirmModal
                    isOpen={true}
                    title={`"${confirmRestore.org_name}" wiederherstellen?`}
                    message={`Aus dem Backup vom ${new Date(confirmRestore.created_at).toLocaleString('de-DE')} werden ${confirmRestore.employee_count} Mitarbeiter und ${confirmRestore.project_count} Projekte wiederhergestellt. Mitarbeiter müssen sich beim ersten Login per Magic-Link neu verknüpfen.`}
                    onConfirm={handleRestore}
                    onCancel={() => setConfirmRestore(null)}
                    type="info"
                    confirmText="Wiederherstellen"
                />
            )}

            {confirmDelete && (
                <ConfirmModal
                    isOpen={true}
                    title="Backup löschen?"
                    message={`Das Backup von "${confirmDelete.org_name}" (${fmtBytes(confirmDelete.size_bytes)}) wird unwiderruflich entfernt. Diese Aktion kann nicht rückgängig gemacht werden.`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    type="danger"
                    confirmText="Endgültig löschen"
                />
            )}
        </div>
    );
}
