'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../supabaseClient';
import { Organization, Employee, OrganizationFeature, FEATURE_CATALOG, OrganizationPlan, OrganizationStatus } from '../../../types';
import { toast } from 'sonner';
import {
    ArrowLeft, Building2, Users, Sparkles, BarChart3, ShieldAlert,
    Save, UserPlus, Trash, Loader2, Eye, Pause, Play, Power,
    Download, Mail, CalendarPlus,
} from 'lucide-react';
import InviteEmployeeModal from '../../../components/SuperAdmin/InviteEmployeeModal';
import ConfirmModal from '../../../components/Modals/ConfirmModal';
import DeleteAgencyDialog from '../../../components/SuperAdmin/DeleteAgencyDialog';
import {
    Card, Field, INPUT_CLS, PrimaryButton, SecondaryButton, DangerButton, StatusBadge, PlanBadge,
} from '../../../components/SuperAdmin/AdminUI';

type Tab = 'overview' | 'employees' | 'features' | 'usage' | 'danger';

const VALID_TABS: Tab[] = ['overview', 'employees', 'features', 'usage', 'danger'];

export default function AgencyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params?.id as string;

    const [org, setOrg] = useState<Organization | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [features, setFeatures] = useState<OrganizationFeature[]>([]);
    const [usage, setUsage] = useState<{ projects: number; clients: number; allocations: number; time_entries_week: number } | null>(null);
    const [loading, setLoading] = useState(true);

    // Aktiver Tab lebt in der URL (?tab=…) → bleibt bei Reload erhalten und ist teilbar
    const tabParam = searchParams.get('tab');
    const tab: Tab = tabParam && VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'overview';
    const setTab = (t: Tab) => router.replace(`/admin/agencies/${id}?tab=${t}`, { scroll: false });

    const reload = async () => {
        const [orgRes, empRes, featRes, usageRes] = await Promise.all([
            supabase.rpc('get_organization_super_admin', { p_org_id: id }),
            supabase.rpc('get_all_employees_super_admin'),
            supabase.from('organization_features').select('*').eq('organization_id', id),
            supabase.rpc('get_org_usage_super_admin', { p_org_id: id }),
        ]);

        if (orgRes.data && orgRes.data.length > 0) setOrg(orgRes.data[0] as Organization);
        if (empRes.data) setEmployees((empRes.data as Employee[]).filter(e => e.organization_id === id));
        if (featRes.data) setFeatures(featRes.data as OrganizationFeature[]);
        if (usageRes.data && usageRes.data.length > 0) {
            const u = usageRes.data[0];
            setUsage({
                projects:          Number(u.project_count)      || 0,
                clients:           Number(u.client_count)       || 0,
                allocations:       Number(u.allocation_count)   || 0,
                time_entries_week: Number(u.time_entries_week)  || 0,
            });
        }
        setLoading(false);
    };

    useEffect(() => { if (id) reload(); }, [id]);

    if (loading || !org) {
        return <div className="text-sm text-text-muted italic py-12 text-center">Lade Agentur…</div>;
    }

    const tabs: { id: Tab; label: string; icon: any }[] = [
        { id: 'overview',  label: 'Übersicht',    icon: Building2 },
        { id: 'employees', label: 'Mitarbeiter',  icon: Users },
        { id: 'features',  label: 'Features',     icon: Sparkles },
        { id: 'usage',     label: 'Nutzung',      icon: BarChart3 },
        { id: 'danger',    label: 'Gefahrenzone', icon: ShieldAlert },
    ];

    return (
        <div className="space-y-5">
            <Link
                href="/admin/agencies"
                className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition font-medium"
            >
                <ArrowLeft size={14} /> Alle Agenturen
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                        {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-text-primary">{org.name}</h1>
                        <div className="text-xs text-text-muted flex items-center gap-2 mt-1">
                            <PlanBadge plan={org.plan} />
                            <span>·</span>
                            <code className="font-mono text-[10px]" style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px' }}>{org.id.slice(0, 8)}…</code>
                        </div>
                    </div>
                </div>

                <StatusBadge status={org.status} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--border-default)' }}>
                {tabs.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition -mb-px"
                            style={{
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
                                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                            }}
                        >
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {tab === 'overview'  && <OverviewTab org={org} onSaved={reload} />}
            {tab === 'employees' && <EmployeesTab org={org} employees={employees} onChange={reload} />}
            {tab === 'features'  && <FeaturesTab orgId={org.id} features={features} onChange={reload} />}
            {tab === 'usage'     && <UsageTab employees={employees.length} usage={usage} />}
            {tab === 'danger'    && <DangerTab org={org} onChanged={reload} onDeleted={() => router.push('/admin/agencies')} />}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Übersicht
// ─────────────────────────────────────────────────────────────

function OverviewTab({ org, onSaved }: { org: Organization; onSaved: () => void }) {
    const [name, setName]         = useState(org.name);
    const [slug, setSlug]         = useState(org.slug || '');
    const [industry, setIndustry] = useState(org.industry || '');
    const [plan, setPlan]         = useState<OrganizationPlan>(org.plan);
    const [maxEmp, setMaxEmp]     = useState(org.max_employees?.toString() || '');
    const [maxProj, setMaxProj]   = useState(org.max_projects?.toString() || '');
    const [notes, setNotes]       = useState(org.notes || '');
    const [trialEnds, setTrialEnds] = useState(org.trial_ends_at?.slice(0, 10) || '');
    const [saving, setSaving] = useState(false);

    const dirty =
        name !== org.name ||
        slug !== (org.slug || '') ||
        industry !== (org.industry || '') ||
        plan !== org.plan ||
        maxEmp !== (org.max_employees?.toString() || '') ||
        maxProj !== (org.max_projects?.toString() || '') ||
        notes !== (org.notes || '') ||
        trialEnds !== (org.trial_ends_at?.slice(0, 10) || '');

    const save = async () => {
        setSaving(true);
        const { error } = await supabase.rpc('update_organization_super_admin', {
            p_org_id:        org.id,
            p_name:          name,
            p_slug:          slug || null,
            p_industry:      industry || null,
            p_plan:          plan,
            p_max_employees: maxEmp === '' ? null : parseInt(maxEmp, 10),
            p_max_projects:  maxProj === '' ? null : parseInt(maxProj, 10),
            p_notes:         notes || null,
            p_trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
        });
        setSaving(false);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        toast.success('Stammdaten gespeichert.');
        onSaved();
    };

    return (
        <Card>
            <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Name">
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_CLS} />
                    </Field>
                    <Field label="Slug">
                        <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className={INPUT_CLS + ' font-mono'} />
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Branche">
                        <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} className={INPUT_CLS} />
                    </Field>
                    <Field label="Plan">
                        <select value={plan} onChange={e => setPlan(e.target.value as OrganizationPlan)} className={INPUT_CLS}>
                            <option value="trial">Trial</option>
                            <option value="pro">Pro</option>
                            <option value="agency">Agency</option>
                            <option value="internal">Intern</option>
                        </select>
                    </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Field label="Max. Mitarbeiter" hint="leer = ∞">
                        <input type="number" min={1} value={maxEmp} onChange={e => setMaxEmp(e.target.value)} className={INPUT_CLS} />
                    </Field>
                    <Field label="Max. Projekte" hint="leer = ∞">
                        <input type="number" min={1} value={maxProj} onChange={e => setMaxProj(e.target.value)} className={INPUT_CLS} />
                    </Field>
                    <Field label="Trial endet" hint={plan === 'trial' ? 'wird nach Ablauf read-only' : 'nur bei Trial relevant'}>
                        <input type="date" value={trialEnds} onChange={e => setTrialEnds(e.target.value)} className={INPUT_CLS} />
                    </Field>
                </div>

                <Field label="Interne Notiz">
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={INPUT_CLS} />
                </Field>
            </div>

            <div className="flex items-center justify-between pt-5 mt-5" style={{ borderTop: '1px solid var(--border-default)' }}>
                <div className="text-[11px] text-text-muted">
                    Erstellt: {org.created_at ? new Date(org.created_at).toLocaleDateString('de-DE') : '–'}
                    {org.last_active_at && <> · Zuletzt aktiv: {new Date(org.last_active_at).toLocaleDateString('de-DE')}</>}
                </div>
                <PrimaryButton onClick={save} disabled={!dirty || saving}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Speichern
                </PrimaryButton>
            </div>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Mitarbeiter
// ─────────────────────────────────────────────────────────────

function EmployeesTab({ org, employees, onChange }: { org: Organization; employees: Employee[]; onChange: () => void }) {
    const [showInvite, setShowInvite] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState<Employee | null>(null);

    const handleRoleChange = async (emp: Employee, newRole: string) => {
        const { error } = await supabase.rpc('update_employee_role_super_admin', {
            target_employee_id: emp.id, new_role: newRole,
        });
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success('Rolle aktualisiert.'); onChange(); }
    };

    const handleRemove = async () => {
        if (!confirmRemove) return;
        const { error } = await supabase.rpc('remove_employee_super_admin', {
            target_employee_id: confirmRemove.id,
        });
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success(`${confirmRemove.name} entfernt.`); onChange(); }
        setConfirmRemove(null);
    };

    return (
        <>
            <Card padded={false}>
                <div className="card-header">
                    <div>
                        <div className="text-sm font-bold text-text-primary">
                            Mitarbeiter ({employees.length}{org.max_employees != null && ` / ${org.max_employees}`})
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">Direkter Invite ohne Approval-Flow</div>
                    </div>
                    <PrimaryButton onClick={() => setShowInvite(true)}>
                        <UserPlus size={14} /> Einladen
                    </PrimaryButton>
                </div>

                {employees.length === 0 ? (
                    <div className="text-sm text-text-muted italic text-center py-10">
                        Noch keine Mitarbeiter in dieser Agentur.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Name</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">E-Mail</span></th>
                                <th className="text-left px-5 py-3"><span className="ds-caption">Rolle</span></th>
                                <th className="text-right px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="hover:bg-hover transition">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                                {emp.initials}
                                            </div>
                                            <span className="text-sm font-semibold text-text-primary">{emp.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-text-secondary">{emp.email}</td>
                                    <td className="px-5 py-3">
                                        <select
                                            value={emp.role || 'user'}
                                            onChange={e => handleRoleChange(emp, e.target.value)}
                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                                        >
                                            <option value="user">Mitarbeiter</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            onClick={() => setConfirmRemove(emp)}
                                            className="btn-ghost p-1.5"
                                            style={{ color: 'var(--text-muted)' }}
                                            title="Entfernen"
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            {showInvite && (
                <InviteEmployeeModal
                    orgId={org.id}
                    orgName={org.name}
                    currentCount={employees.length}
                    maxAllowed={org.max_employees}
                    onClose={() => setShowInvite(false)}
                    onSuccess={onChange}
                />
            )}

            {confirmRemove && (
                <ConfirmModal
                    isOpen={true}
                    title="Mitarbeiter entfernen?"
                    message={`${confirmRemove.name} (${confirmRemove.email}) wird endgültig aus der Agentur entfernt. Diese Aktion kann nicht rückgängig gemacht werden.`}
                    onConfirm={handleRemove}
                    onCancel={() => setConfirmRemove(null)}
                    type="danger"
                    confirmText="Entfernen"
                />
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Feature-Flags
// ─────────────────────────────────────────────────────────────

function FeaturesTab({ orgId, features, onChange }: { orgId: string; features: OrganizationFeature[]; onChange: () => void }) {
    const [busy, setBusy] = useState<string | null>(null);

    const isEnabled = (key: string): boolean => {
        const f = features.find(x => x.feature_key === key);
        if (f) return f.enabled;
        return FEATURE_CATALOG.find(c => c.key === key)?.defaultEnabled ?? false;
    };

    const toggle = async (key: string, next: boolean) => {
        setBusy(key);
        const { error } = await supabase.rpc('set_org_feature', {
            p_org_id: orgId, p_feature_key: key, p_enabled: next,
        });
        setBusy(null);
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success(next ? 'Aktiviert' : 'Deaktiviert'); onChange(); }
    };

    return (
        <Card>
            <div className="mb-5">
                <h3 className="text-sm font-bold text-text-primary mb-1">Feature-Flags</h3>
                <p className="text-xs text-text-muted">
                    Drossle einzelne Module pro Agentur. Änderungen greifen sofort, ohne dass sich Nutzer neu anmelden müssen.
                </p>
            </div>

            <div className="space-y-2">
                {FEATURE_CATALOG.map(f => {
                    const enabled = isEnabled(f.key);
                    const loading = busy === f.key;
                    return (
                        <div key={f.key}
                            className="flex items-center justify-between gap-4 p-3.5 rounded-xl"
                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-text-primary">{f.label}</span>
                                    {f.requiredPlan && (
                                        <span className="badge badge-default">{f.requiredPlan}</span>
                                    )}
                                </div>
                                <p className="text-xs text-text-muted mt-0.5">{f.description}</p>
                            </div>
                            <button
                                onClick={() => toggle(f.key, !enabled)}
                                disabled={loading}
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0"
                                style={{ background: enabled ? 'var(--accent)' : 'var(--border-strong)' }}
                            >
                                <span
                                    className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                                    style={{ transform: `translateX(${enabled ? '22px' : '2px'})` }}
                                />
                            </button>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Nutzung
// ─────────────────────────────────────────────────────────────

function UsageTab({ employees, usage }: { employees: number; usage: { projects: number; clients: number; allocations: number; time_entries_week: number } | null }) {
    if (!usage) return null;
    const tiles = [
        { label: 'Mitarbeiter',     value: employees,                  hint: 'aktive Accounts' },
        { label: 'Projekte',        value: usage.projects,             hint: 'angelegt' },
        { label: 'Kunden',          value: usage.clients,              hint: 'angelegt' },
        { label: 'Allokationen',    value: usage.allocations,          hint: 'Ressourcen-Einträge' },
        { label: 'Stunden 7 Tage',  value: usage.time_entries_week,    hint: 'Time-Entries letzte Woche' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiles.map(t => (
                <Card key={t.label}>
                    <div className="ds-caption mb-2">{t.label}</div>
                    <div className="text-3xl font-bold text-text-primary mb-1">{t.value}</div>
                    <div className="text-[11px] text-text-muted">{t.hint}</div>
                </Card>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Gefahrenzone
// ─────────────────────────────────────────────────────────────

function DangerTab({ org, onChanged, onDeleted }: { org: Organization; onChanged: () => void; onDeleted: () => void }) {
    const [working, setWorking] = useState<string | null>(null);
    const [showDelete, setShowDelete] = useState(false);
    const [confirmStatus, setConfirmStatus] = useState<OrganizationStatus | null>(null);

    const changeStatus = async (status: OrganizationStatus) => {
        setWorking(status);
        const { error } = await supabase.rpc('update_organization_super_admin', {
            p_org_id: org.id, p_status: status,
        });
        setWorking(null);
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success(`Status: ${status}`); onChanged(); }
        setConfirmStatus(null);
    };

    const startImpersonation = async () => {
        setWorking('impersonate');
        const { error } = await supabase.rpc('start_impersonation', { p_target_org_id: org.id });
        if (error) { setWorking(null); toast.error('Fehler: ' + error.message); return; }
        toast.success(`Impersonation gestartet — du siehst "${org.name}" als Support.`);
        window.location.href = '/dashboard';
    };

    const exportBackup = async () => {
        setWorking('export');
        // Speichert Backup zentral in DB + lädt es zusätzlich lokal runter
        const { error: saveErr } = await supabase.rpc('save_agency_backup', {
            p_org_id: org.id, p_reason: 'manual',
        });
        if (saveErr) {
            setWorking(null);
            toast.error('Backup fehlgeschlagen: ' + saveErr.message);
            return;
        }

        const { data, error } = await supabase.rpc('export_organization_backup', { p_org_id: org.id });
        setWorking(null);
        if (error || !data) { toast.error('Download fehlgeschlagen: ' + (error?.message || 'unbekannt')); return; }

        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const safeName = org.name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
        const filename = `agentur-os_backup_${safeName}_${stamp}.json`;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Backup gespeichert im System + heruntergeladen.`);
    };

    const extendTrial = async () => {
        setWorking('extend');
        const { data, error } = await supabase.rpc('extend_trial_super_admin', {
            p_org_id: org.id, p_days: 30,
        });
        setWorking(null);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        toast.success(`Trial verlängert bis ${new Date(data as string).toLocaleDateString('de-DE')}`);
        onChanged();
    };

    const resendOwnerMagicLink = async () => {
        setWorking('resend');
        const { data, error } = await supabase.rpc('get_org_owner_super_admin', { p_org_id: org.id });
        if (error || !data || data.length === 0) {
            setWorking(null);
            toast.error('Kein Owner gefunden.');
            return;
        }
        const ownerEmail = data[0].email as string;
        const ownerName = (data[0].name as string) || ownerEmail.split('@')[0];

        // Login-Link server-seitig erzeugen + gebrandete Mail über Resend
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({ email: ownerEmail, name: ownerName, organizationId: org.id, role: 'admin' }),
        });
        setWorking(null);
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            toast.error('Mail fehlgeschlagen: ' + (d.error || res.statusText));
        } else {
            toast.success(`Login-Link an ${ownerEmail} verschickt.`);
        }
    };

    return (
        <>
            <div className="space-y-4">
                {/* Impersonation */}
                <Card>
                    <DangerRow
                        icon={Eye}
                        tone="info"
                        title="Als diese Agentur einloggen"
                        subtitle="Für Support — du siehst die App, wie der Owner sie sieht. 2h-Limit, jederzeit beendbar."
                        action={
                            <PrimaryButton onClick={startImpersonation} disabled={working === 'impersonate'}>
                                {working === 'impersonate' ? 'Starte…' : 'Impersonation starten'}
                            </PrimaryButton>
                        }
                    />
                </Card>

                {/* Backup-Export */}
                <Card>
                    <DangerRow
                        icon={Download}
                        tone="info"
                        title="Daten als JSON exportieren"
                        subtitle="Lädt ein vollständiges Backup aller Daten dieser Agentur herunter — Mitarbeiter, Projekte, Kunden, Zeitbuchungen, Allokationen."
                        action={
                            <SecondaryButton onClick={exportBackup} disabled={working === 'export'}>
                                {working === 'export'
                                    ? <><Loader2 size={14} className="animate-spin" /> Exportiere…</>
                                    : <><Download size={14} /> Backup exportieren</>}
                            </SecondaryButton>
                        }
                    />
                </Card>

                {/* Trial verlängern (nur bei Trial-Plan) */}
                {org.plan === 'trial' && (
                    <Card>
                        <DangerRow
                            icon={CalendarPlus}
                            tone="success"
                            title="Trial um 30 Tage verlängern"
                            subtitle={org.trial_ends_at
                                ? `Aktuelles Ende: ${new Date(org.trial_ends_at).toLocaleDateString('de-DE')}`
                                : 'Aktuell ist kein Trial-Endtermin gesetzt.'}
                            action={
                                <SecondaryButton onClick={extendTrial} disabled={working === 'extend'}>
                                    {working === 'extend'
                                        ? <><Loader2 size={14} className="animate-spin" /> Verlängere…</>
                                        : <><CalendarPlus size={14} /> +30 Tage</>}
                                </SecondaryButton>
                            }
                        />
                    </Card>
                )}

                {/* Owner Magic-Link erneut senden */}
                <Card>
                    <DangerRow
                        icon={Mail}
                        tone="info"
                        title="Magic-Link an Owner erneut senden"
                        subtitle="Falls die ursprüngliche Einladung verloren ging oder der Link abgelaufen ist."
                        action={
                            <SecondaryButton onClick={resendOwnerMagicLink} disabled={working === 'resend'}>
                                {working === 'resend'
                                    ? <><Loader2 size={14} className="animate-spin" /> Sende…</>
                                    : <><Mail size={14} /> Mail senden</>}
                            </SecondaryButton>
                        }
                    />
                </Card>

                {/* Status */}
                <Card>
                    <div className="font-semibold text-sm text-text-primary mb-1">Agentur-Status</div>
                    <p className="text-xs text-text-muted mb-4">
                        Wechsel zwischen aktiv / read-only / gesperrt. Read-Only erlaubt Login, aber blockiert
                        alle Schreib-Aktionen. Gesperrt blockiert auch den Login.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        <StatusButton active={org.status === 'active'}    label="Aktiv"     icon={Play}  color="success" onClick={() => changeStatus('active')}             busy={working === 'active'} />
                        <StatusButton active={org.status === 'read_only'} label="Read-Only" icon={Pause} color="warning" onClick={() => setConfirmStatus('read_only')}      busy={working === 'read_only'} />
                        <StatusButton active={org.status === 'suspended'} label="Gesperrt"  icon={Power} color="danger"  onClick={() => setConfirmStatus('suspended')}      busy={working === 'suspended'} />
                    </div>
                </Card>

                {/* Delete — auffälliger Container */}
                <div className="rounded-2xl p-6" style={{
                    background: 'var(--color-danger-subtle)',
                    border: '1px solid var(--color-danger-border)',
                }}>
                    <DangerRow
                        icon={Trash}
                        tone="danger"
                        title="Agentur unwiderruflich löschen"
                        subtitle="Löscht alle Daten dieser Agentur. Vorher wird automatisch ein JSON-Backup heruntergeladen, und du musst den Namen zur Bestätigung eintippen."
                        action={
                            <DangerButton onClick={() => setShowDelete(true)}>
                                <Trash size={14} /> Agentur löschen
                            </DangerButton>
                        }
                    />
                </div>
            </div>

            {showDelete && (
                <DeleteAgencyDialog
                    org={org}
                    onClose={() => setShowDelete(false)}
                    onDeleted={onDeleted}
                />
            )}

            {confirmStatus && (
                <ConfirmModal
                    isOpen={true}
                    title={confirmStatus === 'suspended' ? 'Agentur sperren?' : 'Read-Only aktivieren?'}
                    message={confirmStatus === 'suspended'
                        ? 'Niemand aus dieser Agentur kann sich mehr einloggen, bis du den Status wieder zurücksetzt.'
                        : 'Mitarbeiter können sich noch einloggen, aber nicht mehr schreibend arbeiten (keine Zeitbuchungen, keine Projekt-Änderungen).'}
                    onConfirm={() => changeStatus(confirmStatus)}
                    onCancel={() => setConfirmStatus(null)}
                    type="warning"
                    confirmText="Ja, ändern"
                />
            )}
        </>
    );
}

function DangerRow({ icon: Icon, tone, title, subtitle, action }: {
    icon: any;
    tone: 'info' | 'success' | 'warning' | 'danger';
    title: string;
    subtitle: string;
    action: React.ReactNode;
}) {
    const palette = {
        info:    { bg: 'var(--color-info-subtle)',    fg: 'var(--color-info-text)' },
        success: { bg: 'var(--color-success-subtle)', fg: 'var(--color-success-text)' },
        warning: { bg: 'var(--color-warning-subtle)', fg: 'var(--color-warning-text)' },
        danger:  { bg: 'rgba(255,255,255,0.5)',       fg: 'var(--color-danger-text)' },
    }[tone];

    return (
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: palette.bg, color: palette.fg }}>
                    <Icon size={16} />
                </div>
                <div className="min-w-0">
                    <div className="font-semibold text-sm text-text-primary">{title}</div>
                    <div className="text-xs text-text-muted">{subtitle}</div>
                </div>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );
}

function StatusButton({ active, label, icon: Icon, color, onClick, busy }: {
    active: boolean; label: string; icon: any;
    color: 'success' | 'warning' | 'danger';
    onClick: () => void; busy: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={busy || active}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition disabled:cursor-default"
            style={active ? {
                background: `var(--color-${color}-subtle)`,
                color: `var(--color-${color}-text)`,
                border: `1px solid var(--color-${color}-border)`,
            } : {
                background: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
            }}
        >
            <Icon size={12} /> {label}{active && ' (aktiv)'}
        </button>
    );
}
