'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, Upload } from 'lucide-react';
import {
    SectionHeader, Card, PrimaryButton, SecondaryButton, StatusBadge, PlanBadge, EmptyState, INPUT_CLS,
} from '../../components/SuperAdmin/AdminUI';
import RestoreAgencyDialog from '../../components/SuperAdmin/RestoreAgencyDialog';
import { useSuperAdmin } from '../../components/SuperAdmin/SuperAdminContext';

export default function AgenciesListPage() {
    const { orgs, loading } = useSuperAdmin();
    const [query, setQuery] = useState('');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showRestore, setShowRestore] = useState(false);

    const filtered = useMemo(() => {
        return orgs.filter(o => {
            if (query && !`${o.name} ${o.slug || ''} ${o.industry || ''}`.toLowerCase().includes(query.toLowerCase()))
                return false;
            if (planFilter !== 'all' && o.plan !== planFilter) return false;
            if (statusFilter !== 'all' && o.status !== statusFilter) return false;
            return true;
        });
    }, [orgs, query, planFilter, statusFilter]);

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Agenturen"
                subtitle={`${orgs.length} Agentur${orgs.length === 1 ? '' : 'en'} im System.`}
                action={
                    <div className="flex gap-2">
                        <SecondaryButton onClick={() => setShowRestore(true)}>
                            <Upload size={14} /> Aus Backup wiederherstellen
                        </SecondaryButton>
                        <Link href="/admin/agencies/new">
                            <PrimaryButton>
                                <Plus size={14} /> Neue Agentur
                            </PrimaryButton>
                        </Link>
                    </div>
                }
            />

            {showRestore && <RestoreAgencyDialog onClose={() => setShowRestore(false)} />}

            <Card padded={false}>
                <div className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Suche nach Name, Slug oder Branche…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className={INPUT_CLS + ' pl-9'}
                        />
                    </div>

                    <select
                        value={planFilter}
                        onChange={e => setPlanFilter(e.target.value)}
                        className={INPUT_CLS + ' w-auto'}
                    >
                        <option value="all">Alle Pläne</option>
                        <option value="trial">Trial</option>
                        <option value="pro">Pro</option>
                        <option value="agency">Agency</option>
                        <option value="internal">Intern</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className={INPUT_CLS + ' w-auto'}
                    >
                        <option value="all">Alle Status</option>
                        <option value="active">Aktiv</option>
                        <option value="read_only">Read-Only</option>
                        <option value="suspended">Gesperrt</option>
                    </select>
                </div>
            </Card>

            {loading ? (
                <div className="text-sm text-text-muted italic py-12 text-center">Lade Agenturen…</div>
            ) : filtered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Building2}
                        title={orgs.length === 0 ? 'Noch keine Agenturen' : 'Keine Treffer'}
                        subtitle={orgs.length === 0
                            ? 'Lege deine erste Agentur an, um loszulegen.'
                            : 'Versuche andere Filter oder eine neue Suche.'}
                        action={orgs.length === 0 ? (
                            <Link href="/admin/agencies/new">
                                <PrimaryButton>
                                    <Plus size={14} /> Erste Agentur anlegen
                                </PrimaryButton>
                            </Link>
                        ) : undefined}
                    />
                </Card>
            ) : (
                <Card padded={false}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Agentur</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Plan</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Status</span></th>
                                <th className="text-right px-5 py-3"><span className="ds-caption">MA</span></th>
                                <th className="text-right px-5 py-3"><span className="ds-caption">Projekte</span></th>
                                <th className="text-right px-5 py-3"><span className="ds-caption">Erstellt</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(o => (
                                <tr key={o.id} className="ds-table-row" onClick={() => window.location.assign(`/admin/agencies/${o.id}`)}>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                                                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                                                {o.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-text-primary">{o.name}</div>
                                                {(o.slug || o.industry) && (
                                                    <div className="text-[11px] text-text-muted">
                                                        {o.slug && <span>{o.slug}</span>}
                                                        {o.slug && o.industry && <span> · </span>}
                                                        {o.industry && <span>{o.industry}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4"><PlanBadge plan={o.plan} /></td>
                                    <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                                    <td className="px-5 py-4 text-right text-sm font-medium text-text-primary">
                                        {o.employee_count}
                                        {o.max_employees != null && <span className="text-text-muted">/{o.max_employees}</span>}
                                    </td>
                                    <td className="px-5 py-4 text-right text-sm font-medium text-text-primary">
                                        {o.project_count}
                                        {o.max_projects != null && <span className="text-text-muted">/{o.max_projects}</span>}
                                    </td>
                                    <td className="px-5 py-4 text-right text-[11px] text-text-muted">
                                        {o.created_at ? new Date(o.created_at).toLocaleDateString('de-DE') : '–'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
