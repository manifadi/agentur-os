'use client';

import React, { useMemo, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import {
    SectionHeader, Card, EmptyState, INPUT_CLS,
} from '../../components/SuperAdmin/AdminUI';
import { useSuperAdmin } from '../../components/SuperAdmin/SuperAdminContext';

const ACTION_LABEL: Record<string, { label: string; tone: 'success' | 'info' | 'danger' | 'warning' | 'default' }> = {
    'organization.create':  { label: 'Agentur erstellt',          tone: 'success' },
    'organization.update':  { label: 'Agentur bearbeitet',        tone: 'info' },
    'organization.delete':  { label: 'Agentur gelöscht',          tone: 'danger' },
    'organization.restore': { label: 'Agentur wiederhergestellt', tone: 'success' },
    'organization.backup':  { label: 'Backup-Export',             tone: 'info' },
    'employee.invite':      { label: 'Mitarbeiter eingeladen',    tone: 'success' },
    'employee.role':        { label: 'Rolle geändert',            tone: 'info' },
    'employee.remove':      { label: 'Mitarbeiter entfernt',      tone: 'danger' },
    'feature.set':          { label: 'Feature umgestellt',        tone: 'info' },
    'impersonation.start':  { label: 'Impersonation gestartet',   tone: 'warning' },
    'impersonation.stop':   { label: 'Impersonation beendet',     tone: 'default' },
    'request.delete':       { label: 'Anfrage gelöscht',          tone: 'danger' },
    'trial.extend':         { label: 'Trial verlängert',          tone: 'success' },
    'backup.save':          { label: 'Backup gespeichert',        tone: 'info' },
    'backup.restore':       { label: 'Backup wiederhergestellt',  tone: 'success' },
    'backup.delete':        { label: 'Backup gelöscht',           tone: 'danger' },
};

const TONE_TO_COLOR: Record<string, string> = {
    success: 'var(--color-success-text)',
    info:    'var(--color-info-text)',
    danger:  'var(--color-danger-text)',
    warning: 'var(--color-warning-text)',
    default: 'var(--text-secondary)',
};

export default function AuditLogPage() {
    const { audit, loading } = useSuperAdmin();
    const [query, setQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');

    const uniqueActions = useMemo(() => Array.from(new Set(audit.map(e => e.action))), [audit]);

    const filtered = useMemo(() => audit.filter(e => {
        if (actionFilter !== 'all' && e.action !== actionFilter) return false;
        if (query) {
            const hay = `${e.actor_email || ''} ${e.action} ${e.target_id || ''} ${JSON.stringify(e.payload || {})}`.toLowerCase();
            if (!hay.includes(query.toLowerCase())) return false;
        }
        return true;
    }), [audit, query, actionFilter]);

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Audit-Log"
                subtitle="Alle Super-Admin-Aktionen — wer hat wann was geändert."
            />

            <Card padded={false}>
                <div className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Suche nach E-Mail, Aktion, Target…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className={INPUT_CLS + ' pl-9'}
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value)}
                        className={INPUT_CLS + ' w-auto'}
                    >
                        <option value="all">Alle Aktionen</option>
                        {uniqueActions.map(a => (
                            <option key={a} value={a}>{ACTION_LABEL[a]?.label || a}</option>
                        ))}
                    </select>
                </div>
            </Card>

            {loading ? (
                <div className="text-sm text-text-muted italic py-12 text-center">Lade…</div>
            ) : filtered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={ScrollText}
                        title="Keine Einträge"
                        subtitle="Keine Audit-Einträge passen zu den aktuellen Filtern."
                    />
                </Card>
            ) : (
                <Card padded={false}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Zeit</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Akteur</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Aktion</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Ziel</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Details</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(e => {
                                const meta = ACTION_LABEL[e.action];
                                return (
                                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="hover:bg-hover transition">
                                        <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                                            {new Date(e.created_at).toLocaleString('de-DE')}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-text-secondary">{e.actor_email || '—'}</td>
                                        <td className="px-5 py-3">
                                            <span className="text-xs font-semibold" style={{ color: TONE_TO_COLOR[meta?.tone || 'default'] }}>
                                                {meta?.label || e.action}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {e.target_type && (
                                                <code className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                                                    {e.target_type}:{(e.target_id || '').slice(0, 8)}
                                                </code>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-[11px] text-text-muted max-w-md truncate">
                                            {e.payload && Object.keys(e.payload).length > 0 ? (
                                                <code className="font-mono" title={JSON.stringify(e.payload, null, 2)}>
                                                    {JSON.stringify(e.payload)}
                                                </code>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
