'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import {
    Absence, AbsenceRequest, VacationBalance,
    ABSENCE_TYPE_LABEL, ABSENCE_TYPE_COLOR, AbsenceType,
} from '../types';
import { usePageTitle } from '../hooks/usePageTitle';
import ViewSwitcher from '../components/UI/ViewSwitcher';
import AbsenceModal from '../components/Absences/AbsenceModal';
import AbsenceIcon from '../components/Absences/AbsenceIcon';
import ConfirmModal from '../components/Modals/ConfirmModal';
import {
    Plane, Inbox, Users as UsersIcon, Plus, Check, X, Trash2, CalendarDays, Loader2,
} from 'lucide-react';
import { absenceWorkingDays, formatAbsenceRange } from '../utils/absences';

type Tab = 'me' | 'team' | 'requests';

export default function AbwesenheitenPage() {
    usePageTitle('Abwesenheiten');
    const { session, employees, agencySettings } = useApp();
    const currentUser = employees.find(e => e.email === session?.user?.email);

    const [tab, setTab] = useState<Tab>('me');
    const [allAbsences, setAllAbsences] = useState<Absence[]>([]);
    const [pending, setPending]         = useState<AbsenceRequest[]>([]);
    const [balance, setBalance]         = useState<VacationBalance | null>(null);
    const [loading, setLoading]         = useState(true);
    const [showModal, setShowModal]     = useState(false);
    const [confirmCancel, setConfirmCancel] = useState<Absence | null>(null);

    const orgId        = currentUser?.organization_id;
    const country      = (agencySettings as any)?.country_code || 'DE';
    const fedState     = (agencySettings as any)?.federal_state || null;
    const isAdmin      = currentUser?.role === 'admin';

    // ── Manager-Check (für "Anfragen an mich" Tab) ────────────────
    const directReports = useMemo(
        () => employees.filter(e => e.manager_id === currentUser?.id),
        [employees, currentUser?.id],
    );
    const canSeeRequests = isAdmin || directReports.length > 0;

    // ── Fetch ─────────────────────────────────────────────────────
    const reload = async () => {
        if (!orgId || !currentUser?.id) return;
        const [absRes, pendRes, balRes] = await Promise.all([
            supabase.from('absences')
                .select('*, employees(id, name, email, initials, avatar_url)')
                .eq('organization_id', orgId)
                .order('start_date', { ascending: false }),
            canSeeRequests
                ? supabase.rpc('get_pending_absence_requests')
                : Promise.resolve({ data: [] } as any),
            supabase.rpc('get_vacation_balance', { p_employee_id: currentUser.id }),
        ]);
        if (absRes.data)   setAllAbsences(absRes.data as Absence[]);
        if (pendRes.data)  setPending(pendRes.data as AbsenceRequest[]);
        if (balRes.data && balRes.data.length > 0) setBalance(balRes.data[0] as VacationBalance);
        setLoading(false);
    };

    useEffect(() => { reload(); }, [orgId, currentUser?.id]);

    // Realtime
    useEffect(() => {
        if (!orgId) return;
        const ch = supabase.channel(`absences:${orgId}`)
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'absences', filter: `organization_id=eq.${orgId}` },
                () => reload())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [orgId]);

    // ── Filtered Lists ────────────────────────────────────────────
    const myAbsences = useMemo(
        () => allAbsences.filter(a => a.employee_id === currentUser?.id && a.status !== 'cancelled'),
        [allAbsences, currentUser?.id],
    );

    const teamAbsences = useMemo(
        () => allAbsences.filter(a => a.status === 'approved'),
        [allAbsences],
    );

    // ── Actions ───────────────────────────────────────────────────
    const handleCancel = async () => {
        if (!confirmCancel) return;
        const { error } = await supabase.rpc('cancel_absence', { p_absence_id: confirmCancel.id });
        setConfirmCancel(null);
        if (error) toast.error('Fehler: ' + error.message);
        else toast.success('Abwesenheit storniert.');
    };

    const handleDecide = async (req: AbsenceRequest, decision: 'approved' | 'rejected') => {
        const { error } = await supabase.rpc('decide_absence', {
            p_absence_id: req.id, p_decision: decision, p_notes: null,
        });
        if (error) toast.error('Fehler: ' + error.message);
        else toast.success(decision === 'approved' ? 'Bestätigt.' : 'Abgelehnt.');
    };

    // ── Render ────────────────────────────────────────────────────
    if (!currentUser) {
        return <div className="p-8 text-sm text-text-muted">Lade…</div>;
    }

    const tabOptions: { value: Tab; label: string; icon: any }[] = [
        { value: 'me',   label: 'Mein Bereich',  icon: Plane },
        { value: 'team', label: 'Team-Übersicht', icon: UsersIcon },
        ...(canSeeRequests
            ? [{ value: 'requests' as Tab, label: `Anfragen${pending.length > 0 ? ` · ${pending.length}` : ''}`, icon: Inbox }]
            : []),
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header
                className="px-8 py-5 flex justify-between items-center flex-wrap gap-4"
                style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}
            >
                <div>
                    <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        Abwesenheiten
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Urlaub · Krank · Homeoffice
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <ViewSwitcher<Tab>
                        options={tabOptions}
                        value={tab}
                        onChange={setTab}
                    />
                    <button onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm active:scale-[0.98]"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        <Plus size={14} /> Eintragen
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--bg-app)' }}>
                <div className="max-w-5xl mx-auto">
                    {tab === 'me' && (
                        <MyTab
                            balance={balance}
                            absences={myAbsences}
                            country={country}
                            state={fedState}
                            onCancel={a => setConfirmCancel(a)}
                            loading={loading}
                        />
                    )}
                    {tab === 'team' && (
                        <TeamTab absences={teamAbsences} employees={employees} loading={loading} />
                    )}
                    {tab === 'requests' && canSeeRequests && (
                        <RequestsTab pending={pending} onDecide={handleDecide} loading={loading} />
                    )}
                </div>
            </main>

            {showModal && (
                <AbsenceModal
                    employeeId={currentUser.id}
                    countryCode={country}
                    federalState={fedState}
                    onClose={() => setShowModal(false)}
                    onSuccess={reload}
                />
            )}

            {confirmCancel && (
                <ConfirmModal
                    isOpen={true}
                    title="Abwesenheit stornieren?"
                    message={`${ABSENCE_TYPE_LABEL[confirmCancel.type]} vom ${formatAbsenceRange(confirmCancel.start_date, confirmCancel.end_date, confirmCancel.half_day)} wird storniert.`}
                    onConfirm={handleCancel}
                    onCancel={() => setConfirmCancel(null)}
                    type="danger"
                    confirmText="Stornieren"
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Mein Bereich
// ─────────────────────────────────────────────────────────────

function MyTab({ balance, absences, country, state, onCancel, loading }: {
    balance: VacationBalance | null;
    absences: Absence[];
    country: string;
    state: string | null;
    onCancel: (a: Absence) => void;
    loading: boolean;
}) {
    if (loading) return <div className="text-sm text-text-muted italic py-8 text-center">Lade…</div>;

    const upcoming = absences.filter(a => new Date(a.end_date) >= new Date(new Date().toISOString().slice(0, 10)));
    const past     = absences.filter(a => new Date(a.end_date) <  new Date(new Date().toISOString().slice(0, 10)));

    return (
        <div className="space-y-6">
            {/* Resturlaub-Karte */}
            {balance && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-header-title">
                            <div className="card-header-icon"><Plane size={14} /></div>
                            <span className="text-sm font-bold text-text-primary">Resturlaub {balance.year}</span>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-4 gap-4">
                            <BalanceTile label="Jahresanspruch" value={balance.yearly_entitlement} unit="Tage" />
                            <BalanceTile label="Übertrag"       value={balance.carryover}          unit="Tage" />
                            <BalanceTile label="Verbraucht"     value={balance.used_days}          unit="Tage" />
                            <BalanceTile label="Verbleibend"    value={balance.remaining}          unit="Tage" highlight />
                        </div>
                        {/* Progress bar */}
                        <div className="mt-4">
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div className="h-full" style={{
                                    width: `${Math.min(100, (balance.used_days / balance.total_available) * 100)}%`,
                                    background: 'var(--accent)',
                                }} />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[11px] text-text-muted">
                                <span>0 Tage</span>
                                <span>{balance.total_available} verfügbar</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Anstehende Abwesenheiten */}
            <Section title="Anstehend" count={upcoming.length}>
                {upcoming.length === 0
                    ? <EmptyHint text="Keine geplanten Abwesenheiten." />
                    : upcoming.map(a => (
                        <AbsenceRow key={a.id} absence={a} country={country} state={state}
                                    onCancel={() => onCancel(a)} showCancel />
                    ))}
            </Section>

            {/* Vergangen */}
            {past.length > 0 && (
                <Section title="Vergangen" count={past.length}>
                    {past.slice(0, 10).map(a => (
                        <AbsenceRow key={a.id} absence={a} country={country} state={state} />
                    ))}
                </Section>
            )}
        </div>
    );
}

function BalanceTile({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
    return (
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <div className="ds-caption mb-1">{label}</div>
            <div className="text-2xl font-bold" style={{ color: highlight ? 'var(--accent)' : 'var(--text-primary)' }}>
                {value}
            </div>
            <div className="text-[10px] text-text-muted">{unit}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Team-Übersicht
// ─────────────────────────────────────────────────────────────

function TeamTab({ absences, employees, loading }: { absences: Absence[]; employees: any[]; loading: boolean }) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayAbsent = absences.filter(a => a.start_date <= todayIso && a.end_date >= todayIso);
    const upcoming = absences
        .filter(a => a.start_date > todayIso)
        .slice(0, 30);

    if (loading) return <div className="text-sm text-text-muted italic py-8 text-center">Lade…</div>;

    return (
        <div className="space-y-6">
            <Section title="Heute abwesend" count={todayAbsent.length}>
                {todayAbsent.length === 0
                    ? <EmptyHint text="Heute ist niemand abwesend." />
                    : todayAbsent.map(a => <AbsenceRow key={a.id} absence={a} showEmployee />)}
            </Section>

            <Section title="Anstehende Abwesenheiten" count={upcoming.length}>
                {upcoming.length === 0
                    ? <EmptyHint text="Keine geplanten Abwesenheiten." />
                    : upcoming.map(a => <AbsenceRow key={a.id} absence={a} showEmployee />)}
            </Section>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Anfragen an mich
// ─────────────────────────────────────────────────────────────

function RequestsTab({ pending, onDecide, loading }: {
    pending: AbsenceRequest[];
    onDecide: (req: AbsenceRequest, decision: 'approved' | 'rejected') => void;
    loading: boolean;
}) {
    if (loading) return <div className="text-sm text-text-muted italic py-8 text-center">Lade…</div>;
    if (pending.length === 0) {
        return (
            <div className="card text-center py-12">
                <div className="empty-state-icon mx-auto"><Inbox size={20} /></div>
                <h3 className="empty-state-title">Alles erledigt</h3>
                <p className="empty-state-subtitle">Keine offenen Anfragen.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {pending.map(req => {
                const color = ABSENCE_TYPE_COLOR[req.type];
                return (
                    <div key={req.id} className="card">
                        <div className="card-body">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                         style={{ background: color.bg, color: color.fg, border: `1px solid ${color.border}` }}>
                                        <AbsenceIcon type={req.type} size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-text-primary">{req.employee_name}</div>
                                        <div className="text-[11px] text-text-muted">{req.employee_email}</div>
                                        <div className="text-xs text-text-secondary mt-2">
                                            <span className="font-semibold">{ABSENCE_TYPE_LABEL[req.type]}</span>
                                            {' · '}
                                            {formatAbsenceRange(req.start_date, req.end_date, req.half_day)}
                                        </div>
                                        {req.reason && (
                                            <div className="text-xs text-text-muted mt-1 italic">„{req.reason}"</div>
                                        )}
                                        <div className="text-[10px] text-text-muted mt-2">
                                            Angefragt: {new Date(req.requested_at).toLocaleString('de-DE')}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => onDecide(req, 'approved')}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition shadow-sm"
                                        style={{ background: 'var(--color-success)', color: 'white' }}>
                                        <Check size={13} /> Bestätigen
                                    </button>
                                    <button onClick={() => onDecide(req, 'rejected')}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition"
                                        style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)', border: '1px solid var(--color-danger-border)' }}>
                                        <X size={13} /> Ablehnen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Reusable
// ─────────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="ds-caption">{title}</span>
                {count > 0 && <span className="badge badge-default">{count}</span>}
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function EmptyHint({ text }: { text: string }) {
    return (
        <div className="text-xs text-text-muted italic py-4 text-center rounded-xl"
             style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)' }}>
            {text}
        </div>
    );
}

function AbsenceRow({ absence, country = 'DE', state, onCancel, showCancel, showEmployee }: {
    absence: Absence;
    country?: string;
    state?: string | null;
    onCancel?: () => void;
    showCancel?: boolean;
    showEmployee?: boolean;
}) {
    const color = ABSENCE_TYPE_COLOR[absence.type];
    const days = absenceWorkingDays(absence, country, state);
    const statusBadge = absence.status === 'requested'
        ? <span className="badge badge-warning">Wartet auf Freigabe</span>
        : absence.status === 'rejected'
        ? <span className="badge badge-danger">Abgelehnt</span>
        : null;

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-hover"
             style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                 style={{ background: color.bg, color: color.fg, border: `1px solid ${color.border}` }}>
                <AbsenceIcon type={absence.type} size={15} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    {showEmployee && absence.employees && (
                        <span className="text-sm font-bold text-text-primary">{absence.employees.name} ·</span>
                    )}
                    <span className="text-sm font-semibold text-text-primary">{ABSENCE_TYPE_LABEL[absence.type]}</span>
                    {statusBadge}
                </div>
                <div className="text-[11px] text-text-muted">
                    {formatAbsenceRange(absence.start_date, absence.end_date, absence.half_day)}
                    {absence.type === 'vacation' && days > 0 && ` · ${days} Tag${days === 1 ? '' : 'e'}`}
                </div>
                {absence.reason && (
                    <div className="text-[11px] text-text-secondary mt-0.5 italic">„{absence.reason}"</div>
                )}
            </div>
            {showCancel && onCancel && (
                <button onClick={onCancel}
                    className="btn-ghost p-1.5"
                    title="Stornieren"
                    style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
}
