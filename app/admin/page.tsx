'use client';

import React from 'react';
import Link from 'next/link';
import {
    Building2, Activity, AlertTriangle, Users, Inbox, ScrollText, ArrowRight, Plus, Archive,
} from 'lucide-react';
import { SectionHeader, Card, PrimaryButton, StatusBadge, PlanBadge } from '../components/SuperAdmin/AdminUI';
import { useSuperAdmin } from '../components/SuperAdmin/SuperAdminContext';

export default function AdminOverviewPage() {
    const { orgs, audit, requests, backups, loading } = useSuperAdmin();

    const totalAgencies = orgs.length;
    const activeAgencies = orgs.filter(o => o.status === 'active').length;
    const suspendedAgencies = orgs.filter(o => o.status === 'suspended').length;
    const totalEmployees = orgs.reduce((sum, o) => sum + (Number(o.employee_count) || 0), 0);

    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const trialEndingSoon = orgs.filter(o =>
        o.plan === 'trial' && o.trial_ends_at &&
        new Date(o.trial_ends_at) < sevenDays
    );

    const auditPreview = audit.slice(0, 8);
    const requestPreview = requests.slice(0, 5);

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Übersicht"
                subtitle="System-Status auf einen Blick."
                action={
                    <Link href="/admin/agencies/new">
                        <PrimaryButton>
                            <Plus size={14} /> Neue Agentur
                        </PrimaryButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Building2}     label="Agenturen gesamt" value={totalAgencies}        sub={`${activeAgencies} aktiv`}            loading={loading} />
                <MetricCard icon={Users}         label="Mitarbeiter"      value={totalEmployees}       sub="über alle Agenturen"                  loading={loading} />
                <MetricCard icon={Activity}      label="Trial endet bald" value={trialEndingSoon.length} sub="in den nächsten 7 Tagen"            loading={loading} accent={trialEndingSoon.length > 0 ? 'warning' : undefined} />
                <MetricCard icon={Archive}       label="Backups"          value={backups.length}       sub={`${backups.filter(b => !b.org_still_exists).length} von gelöschten`} loading={loading} />
            </div>

            {suspendedAgencies > 0 && (
                <div className="grid grid-cols-1 gap-4">
                    <MetricCard icon={AlertTriangle} label="Gesperrt" value={suspendedAgencies} sub="suspended Agenturen" loading={loading} accent="danger" />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" padded={false}>
                    <div className="card-header">
                        <div className="card-header-title">
                            <div className="card-header-icon"><Building2 size={14} /></div>
                            <span className="text-sm font-bold text-text-primary">Aktive Agenturen</span>
                        </div>
                        <Link href="/admin/agencies" className="text-[12px] font-semibold text-text-muted hover:text-text-primary flex items-center gap-1">
                            Alle ansehen <ArrowRight size={12} />
                        </Link>
                    </div>

                    <div className="p-5">
                        {loading ? (
                            <div className="text-sm text-text-muted italic py-6 text-center">Lade…</div>
                        ) : orgs.length === 0 ? (
                            <div className="text-sm text-text-muted italic py-8 text-center">
                                Noch keine Agenturen angelegt.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {orgs.slice(0, 6).map(o => (
                                    <Link
                                        key={o.id}
                                        href={`/admin/agencies/${o.id}`}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition hover:bg-hover"
                                    >
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                            {o.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-text-primary truncate">{o.name}</div>
                                            <div className="text-[11px] text-text-muted">
                                                {o.employee_count} MA · {o.project_count} Projekte
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <PlanBadge plan={o.plan} />
                                            <StatusBadge status={o.status} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card padded={false}>
                        <div className="card-header">
                            <div className="card-header-title">
                                <div className="card-header-icon"><Inbox size={14} /></div>
                                <span className="text-sm font-bold text-text-primary">Offene Anfragen</span>
                            </div>
                            {requests.length > 0 && (
                                <Link href="/admin/requests" className="text-[12px] font-semibold text-text-muted hover:text-text-primary flex items-center gap-1">
                                    Alle <ArrowRight size={12} />
                                </Link>
                            )}
                        </div>
                        <div className="p-5">
                            {requestPreview.length === 0 ? (
                                <div className="text-xs text-text-muted italic py-2 text-center">Keine offenen Anfragen.</div>
                            ) : (
                                <div className="space-y-2">
                                    {requestPreview.map(r => (
                                        <div key={r.id} className="p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <div className="font-semibold text-sm text-text-primary truncate">{r.name}</div>
                                            <div className="text-[12px] text-text-muted truncate">{r.email}</div>
                                            {r.company_name && (
                                                <div className="text-[11px] text-text-muted mt-1">
                                                    Wunsch: {r.company_name}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card padded={false}>
                        <div className="card-header">
                            <div className="card-header-title">
                                <div className="card-header-icon"><ScrollText size={14} /></div>
                                <span className="text-sm font-bold text-text-primary">Letzte Aktivität</span>
                            </div>
                            <Link href="/admin/audit" className="text-[12px] font-semibold text-text-muted hover:text-text-primary flex items-center gap-1">
                                Mehr <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="p-5">
                            {auditPreview.length === 0 ? (
                                <div className="text-xs text-text-muted italic py-2 text-center">Noch keine Einträge.</div>
                            ) : (
                                <div className="space-y-2.5">
                                    {auditPreview.map(a => (
                                        <div key={a.id} className="text-xs">
                                            <div className="font-semibold text-text-primary">{a.action}</div>
                                            <div className="text-text-muted">
                                                {a.actor_email || 'System'} · {new Date(a.created_at).toLocaleString('de-DE')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, sub, loading, accent }: {
    icon: any; label: string; value: number; sub?: string; loading?: boolean; accent?: 'danger' | 'warning';
}) {
    const accentColor =
        accent === 'danger'  ? 'var(--color-danger)'
        : accent === 'warning' ? 'var(--color-warning)'
        : undefined;

    return (
        <Card>
            <div className="flex items-center justify-between mb-3">
                <span className="ds-caption">{label}</span>
                <Icon size={14} style={{ color: accentColor || 'var(--text-muted)' }} />
            </div>
            <div className="text-3xl font-bold mb-1" style={{ color: accentColor || 'var(--text-primary)' }}>
                {loading ? '–' : value}
            </div>
            {sub && <div className="text-[11px] text-text-muted">{sub}</div>}
        </Card>
    );
}
