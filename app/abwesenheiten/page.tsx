'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import {
    Absence, AbsenceRequest, VacationBalance, Employee,
    ABSENCE_TYPE_LABEL, ABSENCE_TYPE_COLOR, AbsenceType, AbsenceStatus,
} from '../types';
import { usePageTitle } from '../hooks/usePageTitle';
import ViewSwitcher from '../components/UI/ViewSwitcher';
import PeriodNavigator from '../components/UI/PeriodNavigator';
import AbsenceModal from '../components/Absences/AbsenceModal';
import AbsenceIcon from '../components/Absences/AbsenceIcon';
import ConfirmModal from '../components/Modals/ConfirmModal';
import {
    Plane, Inbox, Users as UsersIcon, Plus, Check, X, Trash2, Sparkles,
} from 'lucide-react';
import {
    absenceWorkingDays, absenceWorkingHours, scheduleOf, computeVacationBalance, formatAbsenceRange,
} from '../utils/absences';

type Tab = 'me' | 'team' | 'requests';
type StatusFilter = 'all' | AbsenceStatus;

// ── Zahlen-Formatierung (de, ohne überflüssige Nachkommastellen) ──
const fmt = (n: number) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 });

const STATUS_BADGE: Record<AbsenceStatus, { label: string; cls: string }> = {
    approved:  { label: 'Genehmigt',  cls: 'badge badge-success' },
    requested: { label: 'Angefragt',  cls: 'badge badge-warning' },
    rejected:  { label: 'Abgelehnt',  cls: 'badge badge-danger' },
    cancelled: { label: 'Storniert',  cls: 'badge badge-default' },
};

export default function AbwesenheitenPage() {
    usePageTitle('Abwesenheiten');
    const { session, employees, agencySettings } = useApp();
    const currentUser = employees.find(e => e.email === session?.user?.email);

    const [tab, setTab] = useState<Tab>('me');
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [allAbsences, setAllAbsences] = useState<Absence[]>([]);
    const [pending, setPending]         = useState<AbsenceRequest[]>([]);
    const [loading, setLoading]         = useState(true);
    const [showModal, setShowModal]     = useState(false);
    const [confirmCancel, setConfirmCancel] = useState<Absence | null>(null);

    const orgId        = currentUser?.organization_id;
    const country      = (agencySettings as any)?.country_code || 'DE';
    const fedState     = (agencySettings as any)?.federal_state || null;
    const isAdmin      = currentUser?.role === 'admin';

    const directReports = useMemo(
        () => employees.filter(e => e.manager_id === currentUser?.id),
        [employees, currentUser?.id],
    );
    const canSeeRequests = isAdmin || directReports.length > 0;

    // Schedule-Resolver (für Stunden pro Zeile)
    const scheduleFor = (employeeId?: string): number[] => {
        const emp = employees.find(e => e.id === employeeId);
        return scheduleOf(emp || ({} as Employee));
    };

    // ── Fetch ─────────────────────────────────────────────────────
    const reload = async () => {
        if (!orgId || !currentUser?.id) return;
        const [absRes, pendRes] = await Promise.all([
            supabase.from('absences')
                .select('*, employees(id, name, email, initials, avatar_url)')
                .eq('organization_id', orgId)
                .order('start_date', { ascending: false }),
            canSeeRequests
                ? supabase.rpc('get_pending_absence_requests')
                : Promise.resolve({ data: [] } as any),
        ]);
        if (absRes.data)   setAllAbsences(absRes.data as Absence[]);
        if (pendRes.data)  setPending(pendRes.data as AbsenceRequest[]);
        setLoading(false);
    };

    useEffect(() => { reload(); }, [orgId, currentUser?.id]);

    useEffect(() => {
        if (!orgId) return;
        const ch = supabase.channel(`absences:${orgId}`)
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'absences', filter: `organization_id=eq.${orgId}` },
                () => reload())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [orgId]);

    // ── Abgeleitete Listen ────────────────────────────────────────
    const myAbsencesAll = useMemo(
        () => allAbsences.filter(a => a.employee_id === currentUser?.id),
        [allAbsences, currentUser?.id],
    );

    const balance: VacationBalance | null = useMemo(
        () => currentUser ? computeVacationBalance(currentUser, myAbsencesAll, year, country, fedState) : null,
        [currentUser, myAbsencesAll, year, country, fedState],
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

    const thisYear = new Date().getFullYear();

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
                        Urlaub · Krank · Zeitausgleich
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {tab === 'me' && (
                        <PeriodNavigator
                            onPrev={() => setYear(y => y - 1)}
                            onNext={() => setYear(y => y + 1)}
                            centerLabel={String(year)}
                            hoverLabel="Aktuelles Jahr"
                            onCenterClick={() => setYear(thisYear)}
                            centerMinWidth={96}
                            centerTitle="Zum aktuellen Jahr"
                        />
                    )}
                    <ViewSwitcher<Tab> options={tabOptions} value={tab} onChange={setTab} />
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
                            absences={myAbsencesAll}
                            year={year}
                            schedule={scheduleOf(currentUser)}
                            country={country}
                            state={fedState}
                            onCancel={a => setConfirmCancel(a)}
                            loading={loading}
                        />
                    )}
                    {tab === 'team' && (
                        <TeamTab absences={teamAbsences} scheduleFor={scheduleFor} country={country} state={fedState} loading={loading} />
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
                    message={`${ABSENCE_TYPE_LABEL[confirmCancel.type]} vom ${formatAbsenceRange(confirmCancel.start_date, confirmCancel.end_date, confirmCancel.half_day, confirmCancel.start_time, confirmCancel.end_time)} wird storniert.`}
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
function MyTab({ balance, absences, year, schedule, country, state, onCancel, loading }: {
    balance: VacationBalance | null;
    absences: Absence[];
    year: number;
    schedule: number[];
    country: string;
    state: string | null;
    onCancel: (a: Absence) => void;
    loading: boolean;
}) {
    const [typeFilter, setTypeFilter]     = useState<'all' | AbsenceType>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Abwesenheiten des gewählten Jahres (Überschneidung mit dem Jahr)
    const yearAbsences = useMemo(() => {
        const yStart = `${year}-01-01`, yEnd = `${year}-12-31`;
        return absences.filter(a => !(a.end_date < yStart || a.start_date > yEnd));
    }, [absences, year]);

    const counts = useMemo(() => ({
        approved:  yearAbsences.filter(a => a.status === 'approved').length,
        requested: yearAbsences.filter(a => a.status === 'requested').length,
        rejected:  yearAbsences.filter(a => a.status === 'rejected').length,
    }), [yearAbsences]);

    const filtered = useMemo(() => yearAbsences.filter(a =>
        (typeFilter === 'all' || a.type === typeFilter)
        && (statusFilter === 'all' || a.status === statusFilter),
    ), [yearAbsences, typeFilter, statusFilter]);

    const todayIso = new Date().toISOString().slice(0, 10);
    const upcoming = filtered.filter(a => a.end_date >= todayIso && a.status !== 'cancelled');
    const rest     = filtered.filter(a => !(a.end_date >= todayIso && a.status !== 'cancelled'));

    if (loading) return <div className="text-sm text-text-muted italic py-8 text-center">Lade…</div>;

    return (
        <div className="space-y-6">
            {balance && <BalanceHero balance={balance} />}

            {/* Status-Zähler */}
            <div className="grid grid-cols-3 gap-3">
                <CountTile label="Genehmigt" value={counts.approved} tone="success" />
                <CountTile label="Angefragt" value={counts.requested} tone="warning" />
                <CountTile label="Abgelehnt" value={counts.rejected} tone="danger" />
            </div>

            {/* Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <TypeChips value={typeFilter} onChange={setTypeFilter} absences={yearAbsences} />
                <ViewSwitcher<StatusFilter>
                    size="sm"
                    options={[
                        { value: 'all',       label: 'Alle' },
                        { value: 'approved',  label: 'Genehmigt' },
                        { value: 'requested', label: 'Angefragt' },
                        { value: 'rejected',  label: 'Abgelehnt' },
                        { value: 'cancelled', label: 'Storniert' },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                />
            </div>

            {/* Historie */}
            <Section title="Anstehend" count={upcoming.length}>
                {upcoming.length === 0
                    ? <EmptyHint text="Keine anstehenden Abwesenheiten." />
                    : upcoming.map(a => (
                        <AbsenceRow key={a.id} absence={a} schedule={schedule} country={country} state={state}
                                    onCancel={() => onCancel(a)} showCancel={a.status !== 'rejected'} />
                    ))}
            </Section>

            {rest.length > 0 && (
                <Section title="Verlauf" count={rest.length}>
                    {rest.map(a => (
                        <AbsenceRow key={a.id} absence={a} schedule={schedule} country={country} state={state} />
                    ))}
                </Section>
            )}
        </div>
    );
}

// ── Balance-Hero ──────────────────────────────────────────────
function BalanceHero({ balance }: { balance: VacationBalance }) {
    const b = balance;
    const usedPct = b.totalHours > 0 ? Math.min(100, (b.usedHours / b.totalHours) * 100) : 0;
    const remainingPositive = b.remainingHours >= 0;

    return (
        <div className="card overflow-hidden">
            <div className="p-6">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    {/* Resturlaub groß */}
                    <div>
                        <div className="ds-caption mb-1.5">Resturlaub {b.year}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black tabular-nums leading-none"
                                  style={{ color: remainingPositive ? 'var(--text-primary)' : 'var(--color-danger)' }}>
                                {fmt(b.remainingDays)}
                            </span>
                            <span className="text-lg font-bold text-text-muted">Tage</span>
                        </div>
                        <div className="text-sm font-semibold text-text-secondary mt-1 tabular-nums">
                            {fmt(b.remainingHours)} Stunden
                        </div>
                    </div>

                    {/* Kontext-Hinweise */}
                    <div className="flex flex-col items-end gap-1.5 text-right">
                        <div className="text-[11px] text-text-muted">
                            {fmt(b.weeks)} Wochen × {fmt(b.weeklyHours)} h/Woche
                        </div>
                        {b.seniorityApplied && (
                            <span className="badge badge-accent inline-flex items-center gap-1"><Sparkles size={10} /> 6 Wochen (25 J.)</span>
                        )}
                        {b.proRated && (
                            <span className="badge badge-default">aliquot (Eintrittsjahr)</span>
                        )}
                        {b.avgDayHours > 0 && (
                            <div className="text-[10px] text-text-muted">1 Tag ≈ {fmt(b.avgDayHours)} h</div>
                        )}
                    </div>
                </div>

                {/* Fortschritt */}
                <div className="mt-5">
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: 'var(--accent)' }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-text-muted tabular-nums">
                        <span>{fmt(b.usedDays)} Tage verbraucht</span>
                        <span>{fmt(b.totalDays)} Tage verfügbar</span>
                    </div>
                </div>

                {/* Detail-Kacheln */}
                <div className="grid grid-cols-4 gap-3 mt-5">
                    <StatTile label="Jahresanspruch" days={b.entitlementDays} hours={b.entitlementHours} />
                    <StatTile label="Übertrag"       days={b.carryoverDays}   hours={b.carryoverHours} />
                    <StatTile label="Verbraucht"     days={b.usedDays}        hours={b.usedHours} />
                    <StatTile label="Verbleibend"    days={b.remainingDays}   hours={b.remainingHours} highlight />
                </div>
            </div>
        </div>
    );
}

function StatTile({ label, days, hours, highlight }: { label: string; days: number; hours: number; highlight?: boolean }) {
    return (
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <div className="ds-caption mb-1">{label}</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: highlight ? 'var(--accent)' : 'var(--text-primary)' }}>
                {fmt(days)} <span className="text-[11px] font-semibold text-text-muted">Tage</span>
            </div>
            <div className="text-[11px] text-text-muted tabular-nums">{fmt(hours)} h</div>
        </div>
    );
}

function CountTile({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
    const color = tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)';
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-2xl font-bold tabular-nums text-text-primary">{value}</span>
            <span className="text-xs text-text-muted">{label}</span>
        </div>
    );
}

function TypeChips({ value, onChange, absences }: {
    value: 'all' | AbsenceType;
    onChange: (v: 'all' | AbsenceType) => void;
    absences: Absence[];
}) {
    const presentTypes = useMemo(() => {
        const set = new Set(absences.map(a => a.type));
        return (Object.keys(ABSENCE_TYPE_LABEL) as AbsenceType[]).filter(t => set.has(t));
    }, [absences]);

    const chip = (active: boolean) => ({
        background: active ? 'var(--accent)' : 'var(--bg-subtle)',
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
    });

    return (
        <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onChange('all')}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition" style={chip(value === 'all')}>
                Alle
            </button>
            {presentTypes.map(t => (
                <button key={t} onClick={() => onChange(t)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition" style={chip(value === t)}>
                    {ABSENCE_TYPE_LABEL[t]}
                </button>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Tab: Team-Übersicht
// ─────────────────────────────────────────────────────────────
function TeamTab({ absences, scheduleFor, country, state, loading }: {
    absences: Absence[];
    scheduleFor: (id?: string) => number[];
    country: string;
    state: string | null;
    loading: boolean;
}) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayAbsent = absences.filter(a => a.start_date <= todayIso && a.end_date >= todayIso);
    const upcoming = absences.filter(a => a.start_date > todayIso).slice(0, 30);

    if (loading) return <div className="text-sm text-text-muted italic py-8 text-center">Lade…</div>;

    return (
        <div className="space-y-6">
            <Section title="Heute abwesend" count={todayAbsent.length}>
                {todayAbsent.length === 0
                    ? <EmptyHint text="Heute ist niemand abwesend." />
                    : todayAbsent.map(a => <AbsenceRow key={a.id} absence={a} schedule={scheduleFor(a.employee_id)} country={country} state={state} showEmployee />)}
            </Section>

            <Section title="Anstehende Abwesenheiten" count={upcoming.length}>
                {upcoming.length === 0
                    ? <EmptyHint text="Keine geplanten Abwesenheiten." />
                    : upcoming.map(a => <AbsenceRow key={a.id} absence={a} schedule={scheduleFor(a.employee_id)} country={country} state={state} showEmployee />)}
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
                                            {formatAbsenceRange(req.start_date, req.end_date, req.half_day, req.start_time, req.end_time)}
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

const TIME_TYPES: AbsenceType[] = ['vacation', 'unpaid_vacation', 'zeitausgleich'];

function AbsenceRow({ absence, schedule, country = 'DE', state, onCancel, showCancel, showEmployee }: {
    absence: Absence;
    schedule?: number[];
    country?: string;
    state?: string | null;
    onCancel?: () => void;
    showCancel?: boolean;
    showEmployee?: boolean;
}) {
    const color = ABSENCE_TYPE_COLOR[absence.type];
    const days = absenceWorkingDays(absence, country, state);
    const hours = schedule ? absenceWorkingHours(absence, schedule, country, state) : null;
    const showAmount = days > 0 && TIME_TYPES.includes(absence.type);
    const badge = STATUS_BADGE[absence.status];

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
                    {absence.status !== 'approved' && <span className={badge.cls}>{badge.label}</span>}
                </div>
                <div className="text-[11px] text-text-muted">
                    {formatAbsenceRange(absence.start_date, absence.end_date, absence.half_day, absence.start_time, absence.end_time)}
                    {showAmount && (
                        <> · {fmt(days)} Tag{days === 1 ? '' : 'e'}{hours != null && hours > 0 && ` (${fmt(hours)} h)`}</>
                    )}
                </div>
                {absence.reason && (
                    <div className="text-[11px] text-text-secondary mt-0.5 italic">„{absence.reason}"</div>
                )}
            </div>
            {showCancel && onCancel && (
                <button onClick={onCancel} className="btn-ghost p-1.5" title="Stornieren" style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
}
