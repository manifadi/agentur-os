'use client';
import React, { useState, useMemo } from 'react';
import { Download, Users, User, Calendar, Folder, Building2, Clock, Pencil, Trash2, Plus, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';
import { TimeEntry, Employee, AttendanceEntry } from '../../types';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    isoDate, formatRangeLabel, aggregatePeriod, aggregateAttendance, attendanceHours,
    buildCsv, buildAttendanceCsv, buildTimeEntriesCsv, downloadCsv,
} from '../../utils/reporting';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import UserAvatar from '../UI/UserAvatar';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import ViewSwitcher from '../UI/ViewSwitcher';
import PeriodNavigator from '../UI/PeriodNavigator';
import SearchableSelect, { SearchableOption } from '../UI/SearchableSelect';
import AttendanceEntryModal from '../Modals/AttendanceEntryModal';
import ConfirmModal from '../Modals/ConfirmModal';

type RangeMode = 'week' | 'month' | 'custom';
type Mode = 'me' | 'employee' | 'project' | 'client';

interface Props {
    currentUser: Employee;
}

export default function ReportingPage({ currentUser }: Props) {
    const { employees, projects, clients } = useApp();
    const isAdmin = currentUser.role === 'admin';
    const orgId = currentUser.organization_id;
    const meId = currentUser.id;

    const [mode, setMode] = useLocalStorage<Mode>('reporting:mode', 'me');
    const [rangeMode, setRangeMode] = useLocalStorage<RangeMode>('reporting:rangeMode', 'week');
    const [anchor, setAnchor] = useState(new Date());
    const [customFrom, setCustomFrom] = useState(() => isoDate(startOfWeek(new Date())));
    const [customTo, setCustomTo] = useState(() => isoDate(endOfWeek(new Date())));

    // Entitäts-Auswahl
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    // Anwesenheits-Korrektur-Modal
    const [attModalOpen, setAttModalOpen] = useState(false);
    const [attToEdit, setAttToEdit] = useState<AttendanceEntry | null>(null);
    const [attToDelete, setAttToDelete] = useState<AttendanceEntry | null>(null);

    // Nicht-Admins dürfen nur den eigenen Mitarbeiter-Modus nicht öffnen
    const effectiveMode: Mode = (mode === 'employee' && !isAdmin) ? 'me' : mode;

    // Sortierte Auswahllisten
    const orgEmployees = useMemo(
        () => employees.filter(e => e.organization_id === orgId).sort((a, b) => a.name.localeCompare(b.name)),
        [employees, orgId],
    );
    const sortedProjects = useMemo(
        () => [...projects].sort((a, b) => (a.title || '').localeCompare(b.title || '')),
        [projects],
    );
    const sortedClients = useMemo(
        () => [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [clients],
    );

    // ── Such-Optionen für die Combobox-Picker ──
    const employeeOptions: SearchableOption[] = useMemo(() => orgEmployees.map(e => ({
        value: e.id,
        label: e.name,
        sublabel: e.job_title || e.email || undefined,
        searchText: `${e.name} ${e.job_title || ''} ${e.email || ''}`.toLowerCase(),
        leading: <UserAvatar src={e.avatar_url} name={e.name} initials={e.initials} size="xs" />,
    })), [orgEmployees]);

    const projectOptions: SearchableOption[] = useMemo(() => sortedProjects.map(p => ({
        value: p.id,
        label: p.title,
        // Untere Zeile exakt: "Projektnummer | Kundenname"
        sublabel: `${p.job_number || '—'} | ${p.clients?.name || 'Kein Kunde'}`,
        // Suche matcht auch über den Kundennamen → tippt man einen Kunden,
        // erscheinen alle seine Projekte.
        searchText: `${p.title} ${p.job_number || ''} ${p.clients?.name || ''}`.toLowerCase(),
        leading: <LeadingBadge icon={Folder} />,
    })), [sortedProjects]);

    const clientOptions: SearchableOption[] = useMemo(() => sortedClients.map(c => ({
        value: c.id,
        label: c.name,
        sublabel: c.full_name || c.website || undefined,
        searchText: `${c.name} ${c.full_name || ''}`.toLowerCase(),
        leading: <LeadingBadge icon={Building2} />,
    })), [sortedClients]);

    // Ziel-Mitarbeiter (für Ich / Mitarbeiter)
    const targetEmployee: Employee | undefined =
        effectiveMode === 'me' ? currentUser
        : effectiveMode === 'employee' ? orgEmployees.find(e => e.id === selectedEmployeeId)
        : undefined;
    const targetEmployeeId = targetEmployee?.id;

    // ── Zeitraum ──
    const { from, to } = useMemo(() => {
        if (rangeMode === 'week') return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
        if (rangeMode === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
        // Freier Zeitraum — leere/ungültige Eingaben tolerieren:
        //   „von" leer → ganz früh (= alle Einträge ab Beginn)
        //   „bis" leer → heute (Ende des Tages)
        const pf = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
        const pt = customTo ? new Date(`${customTo}T23:59:59`) : null;
        const f = pf && !isNaN(pf.getTime()) ? pf : new Date(2000, 0, 1);
        const t = pt && !isNaN(pt.getTime()) ? pt : endOfToday();
        return { from: f, to: t };
    }, [rangeMode, anchor, customFrom, customTo]);

    // Bei offenem freien Zeitraum den Label-Text sprechender machen
    const rangeLabel = useMemo(() => {
        if (rangeMode === 'custom' && !customFrom) {
            return customTo ? `Gesamt bis ${formatRangeLabel(to, to)}` : 'Gesamter Zeitraum';
        }
        return formatRangeLabel(from, to);
    }, [rangeMode, customFrom, customTo, from, to]);

    const fromIso = useMemo(() => isoDate(from), [from]);
    const toIso = useMemo(() => isoDate(to), [to]);
    const fromTs = useMemo(() => from.toISOString(), [from]);
    const toTs = useMemo(() => to.toISOString(), [to]);

    const needsTimeEntries = true;
    const needsAttendance = effectiveMode === 'me' || effectiveMode === 'employee';

    // ── Projektzeit-Query (mode-abhängig) ──
    const timeQuery = useRealtimeTable<TimeEntry>({
        table: 'time_entries',
        filter: null,
        enabled: !!orgId && needsTimeEntries,
        fetchFn: async () => {
            if (!orgId) return [];
            let q = supabase.from('time_entries')
                .select('*, employees(id, name, initials, avatar_url), projects!inner(id, title, job_number, client_id, clients(id, name)), positions:agency_positions(id, title)')
                .gte('date', fromIso)
                .lte('date', toIso);
            if (effectiveMode === 'me' || effectiveMode === 'employee') {
                if (!targetEmployeeId) return [];
                q = q.eq('employee_id', targetEmployeeId);
            } else if (effectiveMode === 'project') {
                if (!selectedProjectId) return [];
                q = q.eq('project_id', selectedProjectId);
            } else if (effectiveMode === 'client') {
                if (!selectedClientId) return [];
                q = q.eq('projects.client_id', selectedClientId);
            }
            const { data } = await q;
            return (data as TimeEntry[]) || [];
        },
        deps: [orgId, fromIso, toIso, effectiveMode, targetEmployeeId, selectedProjectId, selectedClientId],
    });
    const timeEntries = timeQuery.data;

    // ── Anwesenheits-Query (nur Ich / Mitarbeiter) ──
    const attQuery = useRealtimeTable<AttendanceEntry>({
        table: 'attendance_entries',
        filter: null,
        enabled: !!orgId && needsAttendance && !!targetEmployeeId,
        fetchFn: async () => {
            if (!targetEmployeeId) return [];
            const { data } = await supabase.from('attendance_entries')
                .select('*, employees(id, name)')
                .eq('employee_id', targetEmployeeId)
                .gte('clock_in', fromTs)
                .lte('clock_in', toTs)
                .order('clock_in', { ascending: true });
            return (data as AttendanceEntry[]) || [];
        },
        deps: [orgId, effectiveMode, targetEmployeeId, fromTs, toTs],
    });
    const attendance = attQuery.data;

    // ── Navigation ──
    const navigate = (dir: -1 | 1) => {
        const d = new Date(anchor);
        if (rangeMode === 'week') d.setDate(d.getDate() + dir * 7);
        else if (rangeMode === 'month') d.setMonth(d.getMonth() + dir);
        setAnchor(d);
    };
    const goNow = () => setAnchor(new Date());

    const handleDeleteAttendance = async () => {
        if (!attToDelete) return;
        const { error } = await supabase.from('attendance_entries').delete().eq('id', attToDelete.id);
        if (error) { /* toast handled globally elsewhere */ }
        setAttToDelete(null);
        attQuery.refresh();
    };

    const canEditAttendance = effectiveMode === 'me' || (effectiveMode === 'employee' && isAdmin);

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-app)' }}>
            {/* Header */}
            <div className="px-6 py-4 flex flex-wrap items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>Reporting</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Anwesenheit, Projekte & Kunden
                    </p>
                </div>

                {/* Modus */}
                <ViewSwitcher<Mode>
                    options={[
                        { value: 'me', label: 'Ich', icon: User },
                        ...(isAdmin ? [{ value: 'employee' as Mode, label: 'Mitarbeiter', icon: Users }] : []),
                        { value: 'project', label: 'Projekt', icon: Folder },
                        { value: 'client', label: 'Kunde', icon: Building2 },
                    ]}
                    value={effectiveMode}
                    onChange={setMode}
                />

                {/* Zeitraum */}
                <ViewSwitcher<RangeMode>
                    options={[
                        { value: 'week', label: 'Woche' },
                        { value: 'month', label: 'Monat' },
                        { value: 'custom', label: 'Frei' },
                    ]}
                    value={rangeMode}
                    onChange={setRangeMode}
                />

                {/* Navigation oder freie Datums-Picker */}
                {rangeMode === 'custom' ? (
                    <div className="flex items-center gap-2">
                        <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-subtle border border-default text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent" />
                        <span className="text-xs text-text-muted">–</span>
                        <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-subtle border border-default text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent" />
                    </div>
                ) : (
                    <PeriodNavigator
                        onPrev={() => navigate(-1)}
                        onNext={() => navigate(1)}
                        centerLabel={rangeMode === 'week'
                            ? `KW ${getWeekNumber(from)}`
                            : from.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                        hoverLabel={rangeMode === 'week' ? 'Aktuelle Woche' : 'Aktueller Monat'}
                        onCenterClick={goNow}
                        centerMinWidth={132}
                        centerTitle="Aktuellen Zeitraum auswählen"
                    />
                )}
            </div>

            {/* Sub-Header: Entitäts-Picker + Range-Label */}
            <div className="px-6 py-2.5 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                {effectiveMode === 'employee' && (
                    <SearchableSelect value={selectedEmployeeId} onChange={setSelectedEmployeeId}
                        placeholder="Mitarbeiter suchen…" emptyText="Kein Mitarbeiter gefunden"
                        options={employeeOptions} minWidth={260} />
                )}
                {effectiveMode === 'project' && (
                    <SearchableSelect value={selectedProjectId} onChange={setSelectedProjectId}
                        placeholder="Projekt oder Kunde suchen…" emptyText="Kein Projekt gefunden"
                        options={projectOptions} minWidth={300} />
                )}
                {effectiveMode === 'client' && (
                    <SearchableSelect value={selectedClientId} onChange={setSelectedClientId}
                        placeholder="Kunde suchen…" emptyText="Kein Kunde gefunden"
                        options={clientOptions} minWidth={260} />
                )}

                <div className="flex items-center gap-2 text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={12} />
                    <span className="font-semibold">{rangeLabel}</span>
                    {(timeQuery.loading || attQuery.loading) && <span className="italic">· Lade…</span>}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
                {(effectiveMode === 'me' || effectiveMode === 'employee') ? (
                    targetEmployee ? (
                        <div className="space-y-8 max-w-5xl mx-auto">
                            <AttendanceSection
                                employeeName={targetEmployee.name}
                                entries={attendance}
                                from={from}
                                to={to}
                                canEdit={canEditAttendance}
                                onAdd={() => { setAttToEdit(null); setAttModalOpen(true); }}
                                onEdit={(e) => { setAttToEdit(e); setAttModalOpen(true); }}
                                onDelete={(e) => setAttToDelete(e)}
                            />
                            <ProjectTimeReport
                                employee={targetEmployee}
                                entries={timeEntries}
                                from={from}
                                to={to}
                                rangeMode={rangeMode}
                                projects={projects}
                            />
                        </div>
                    ) : (
                        <EmptyState text="Bitte einen Mitarbeiter auswählen." />
                    )
                ) : effectiveMode === 'project' ? (
                    selectedProjectId ? (
                        <ScopedReport
                            entries={timeEntries}
                            groupBy="employee"
                            employees={orgEmployees}
                            projects={projects}
                            from={from}
                            title={sortedProjects.find(p => p.id === selectedProjectId)?.title || 'Projekt'}
                        />
                    ) : (
                        <EmptyState text="Bitte ein Projekt auswählen." />
                    )
                ) : (
                    selectedClientId ? (
                        <ScopedReport
                            entries={timeEntries}
                            groupBy="project"
                            employees={orgEmployees}
                            projects={projects}
                            from={from}
                            title={sortedClients.find(c => c.id === selectedClientId)?.name || 'Kunde'}
                        />
                    ) : (
                        <EmptyState text="Bitte einen Kunden auswählen." />
                    )
                )}
            </div>

            {/* Anwesenheits-Korrektur */}
            {targetEmployee && orgId && (
                <AttendanceEntryModal
                    isOpen={attModalOpen}
                    onClose={() => setAttModalOpen(false)}
                    organizationId={orgId}
                    employeeId={targetEmployee.id}
                    entryToEdit={attToEdit}
                    onSaved={() => attQuery.refresh()}
                />
            )}
            <ConfirmModal
                isOpen={!!attToDelete}
                title="Stempelzeit löschen?"
                message="Dieser Anwesenheits-Eintrag wird dauerhaft entfernt."
                type="danger"
                confirmText="Löschen"
                onConfirm={handleDeleteAttendance}
                onCancel={() => setAttToDelete(null)}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Anwesenheit (Stempelzeit)
// ─────────────────────────────────────────────────────────────────────
function AttendanceSection({
    employeeName, entries, from, to, canEdit, onAdd, onEdit, onDelete,
}: {
    employeeName: string;
    entries: AttendanceEntry[];
    from: Date; to: Date;
    canEdit: boolean;
    onAdd: () => void;
    onEdit: (e: AttendanceEntry) => void;
    onDelete: (e: AttendanceEntry) => void;
}) {
    const stats = useMemo(() => aggregateAttendance(entries, from, to), [entries, from, to]);

    const handleExport = () => {
        const csv = buildAttendanceCsv(stats.sessions, employeeName);
        downloadCsv(csv, `anwesenheit_${employeeName.replace(/\s+/g, '_')}_${isoDate(from)}_${isoDate(to)}.csv`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Clock size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Anwesenheit (Stempeluhr)</h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Eingestempelt" value={`${formatHours(stats.totalHours)} h`} sub={`${stats.sessions.length} Sessions`} />
                <KpiCard label="Tage anwesend" value={String(stats.days.length)} sub="mit Stempelzeit" />
                <KpiCard label="Ø pro Tag" value={stats.days.length ? `${formatHours(stats.totalHours / stats.days.length)} h` : '–'} />
            </div>

            <Card title="Stempelzeiten" right={
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <button onClick={onAdd} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                            <Plus size={12} /> Nachtragen
                        </button>
                    )}
                    <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                        <Download size={12} /> CSV
                    </button>
                </div>
            }>
                {stats.days.length === 0 ? (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Keine Stempelzeiten in diesem Zeitraum.</p>
                ) : (
                    <div className="space-y-4">
                        {stats.days.map(day => {
                            const dt = new Date(day.date);
                            return (
                                <div key={day.date}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {dt.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                                        </div>
                                        <div className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatHours(day.hours)} h</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        {day.sessions.map(s => (
                                            <div key={s.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg"
                                                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                                <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {fmtClock(s.clock_in)} – {s.clock_out ? fmtClock(s.clock_out) : <span style={{ color: 'var(--color-success)' }}>läuft…</span>}
                                                </span>
                                                <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                    {formatHours(attendanceHours(s))} h
                                                </span>
                                                {s.note && <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>· {s.note}</span>}
                                                {canEdit && (
                                                    <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                                        <button onClick={() => onEdit(s)} title="Bearbeiten" className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button>
                                                        <button onClick={() => onDelete(s)} title="Löschen" className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Projektzeit eines Mitarbeiters (Ich / Mitarbeiter)
// ─────────────────────────────────────────────────────────────────────
function ProjectTimeReport({
    employee, entries, from, to, rangeMode, projects,
}: {
    employee: Employee;
    entries: TimeEntry[];
    from: Date; to: Date;
    rangeMode: RangeMode;
    projects: any[];
}) {
    const schedule = employee.weekly_schedule || defaultSchedule(employee.weekly_hours);
    const weeklyTarget = schedule.reduce((s, h) => s + h, 0);
    const stats = useMemo(() => aggregatePeriod(entries, from, to, schedule, projects), [entries, from, to, schedule, projects]);

    const handleExport = () => {
        const csv = buildCsv(entries, employee, projects);
        downloadCsv(csv, `projektzeit_${employee.name.replace(/\s+/g, '_')}_${isoDate(from)}_${isoDate(to)}.csv`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <FileText size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Projektzeit</h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Erfasst" value={`${formatHours(stats.totalHours)} h`} sub={`${entries.length} Buchungen`} />
                <KpiCard label="Soll" value={`${formatHours(stats.targetHours)} h`} sub={`${weeklyTarget}h / Woche`} />
                <KpiCard label="Differenz"
                    value={`${stats.deltaHours >= 0 ? '+' : ''}${formatHours(stats.deltaHours)} h`}
                    sub={`${stats.deltaPct >= 0 ? '+' : ''}${Math.round(stats.deltaPct * 100)}%`}
                    tone={stats.deltaHours >= 0 ? 'positive' : 'negative'} />
            </div>

            <Card title="Tages-Verteilung" right={
                <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <Download size={12} /> CSV
                </button>
            }>
                {stats.days.length > 0 && stats.days.length <= 62
                    ? <DayBars days={stats.days} schedule={schedule} />
                    : <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                        Zeitraum zu groß für die Tagesansicht – siehe Projekt-Verteilung &amp; Einzelbuchungen.
                    </p>}
            </Card>

            <Card title="Projekt-Verteilung">
                {stats.projects.length === 0
                    ? <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Keine Buchungen in diesem Zeitraum.</p>
                    : <ProjectBars projects={stats.projects} total={stats.totalHours} />}
            </Card>

            <Card title="Einzelbuchungen">
                <EntriesTable entries={entries} showProject showEmployee={false} />
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Projekt- / Kunden-Report (gruppiert)
// ─────────────────────────────────────────────────────────────────────
function ScopedReport({
    entries, groupBy, employees, projects, from, title,
}: {
    entries: TimeEntry[];
    groupBy: 'employee' | 'project';
    employees: Employee[];
    projects: any[];
    from: Date;
    title: string;
}) {
    const total = entries.reduce((s, e) => s + Number(e.hours || 0), 0);

    const groups = useMemo(() => {
        const map = new Map<string, { id: string; label: string; sub?: string; hours: number }>();
        for (const e of entries) {
            if (groupBy === 'employee') {
                const emp = (e as any).employees || employees.find(em => em.id === e.employee_id);
                const id = e.employee_id;
                const cur = map.get(id);
                if (cur) cur.hours += Number(e.hours || 0);
                else map.set(id, { id, label: emp?.name || '(unbekannt)', sub: emp?.job_title, hours: Number(e.hours || 0) });
            } else {
                const proj = e.projects || projects.find(p => p.id === e.project_id);
                const id = e.project_id;
                const cur = map.get(id);
                if (cur) cur.hours += Number(e.hours || 0);
                else map.set(id, { id, label: proj?.title || '(unbekanntes Projekt)', sub: (proj as any)?.clients?.name, hours: Number(e.hours || 0) });
            }
        }
        return Array.from(map.values())
            .map(g => ({ ...g, pct: total > 0 ? g.hours / total : 0 }))
            .sort((a, b) => b.hours - a.hours);
    }, [entries, groupBy, employees, projects, total]);

    const handleExport = () => {
        const csv = buildTimeEntriesCsv(entries, employees, projects);
        const scope = groupBy === 'employee' ? 'projekt' : 'kunde';
        downloadCsv(csv, `${scope}_${title.replace(/\s+/g, '_')}_${isoDate(from)}.csv`);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Gesamt erfasst" value={`${formatHours(total)} h`} sub={`${entries.length} Buchungen`} />
                <KpiCard label={groupBy === 'employee' ? 'Mitarbeiter' : 'Projekte'} value={String(groups.length)} />
                <KpiCard label="Ø pro Buchung" value={entries.length ? `${formatHours(total / entries.length)} h` : '–'} />
            </div>

            <Card title={groupBy === 'employee' ? 'Verteilung nach Mitarbeiter' : 'Verteilung nach Projekt'} right={
                <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <Download size={12} /> CSV
                </button>
            }>
                {groups.length === 0
                    ? <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Keine Buchungen in diesem Zeitraum.</p>
                    : <RankBars items={groups} />}
            </Card>

            <Card title="Einzelbuchungen">
                <EntriesTable entries={entries} showProject={groupBy === 'project'} showEmployee />
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Shared UI primitives
// ─────────────────────────────────────────────────────────────────────
function LeadingBadge({ icon: Icon }: { icon: React.ComponentType<any> }) {
    return (
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <Icon size={14} style={{ color: 'var(--text-muted)' }} />
        </span>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                <FileText size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{text}</p>
        </div>
    );
}

function EntriesTable({ entries, showProject, showEmployee }: { entries: TimeEntry[]; showProject: boolean; showEmployee: boolean }) {
    const sorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);
    if (sorted.length === 0) {
        return <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Keine Buchungen.</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                        <th className="font-bold pb-2 pr-3">Datum</th>
                        {showEmployee && <th className="font-bold pb-2 pr-3">Mitarbeiter</th>}
                        {showProject && <th className="font-bold pb-2 pr-3">Projekt</th>}
                        <th className="font-bold pb-2 pr-3 text-right">Std.</th>
                        <th className="font-bold pb-2">Beschreibung</th>
                    </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {sorted.map(e => {
                        const emp = (e as any).employees;
                        const proj = e.projects;
                        return (
                            <tr key={e.id}>
                                <td className="py-2 pr-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                    {new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </td>
                                {showEmployee && <td className="py-2 pr-3 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{emp?.name || '–'}</td>}
                                {showProject && (
                                    <td className="py-2 pr-3" style={{ color: 'var(--text-primary)' }}>
                                        {proj?.title || '–'}
                                        {(proj as any)?.clients?.name && <span className="ml-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>· {(proj as any).clients.name}</span>}
                                    </td>
                                )}
                                <td className="py-2 pr-3 text-right tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{formatHours(Number(e.hours || 0))}</td>
                                <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{e.description || <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function RankBars({ items }: { items: { id: string; label: string; sub?: string; hours: number; pct: number }[] }) {
    const max = Math.max(...items.map(i => i.hours), 1);
    return (
        <div className="space-y-2.5">
            {items.map(i => (
                <div key={i.id}>
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {i.label}
                            {i.sub && <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>· {i.sub}</span>}
                        </span>
                        <span className="text-xs tabular-nums shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
                            {formatHours(i.hours)} h <span style={{ color: 'var(--text-muted)' }}>({Math.round(i.pct * 100)}%)</span>
                        </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                        <div className="h-full transition-all" style={{ width: `${(i.hours / max) * 100}%`, background: 'var(--accent)' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                {right}
            </div>
            {children}
        </div>
    );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'positive' | 'negative' }) {
    const toneColor = tone === 'positive' ? '#10B981' : tone === 'negative' ? '#EF4444' : 'var(--text-primary)';
    return (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: toneColor }}>{value}</div>
            {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
    );
}

function DayBars({ days, schedule }: { days: { date: string; hours: number }[]; schedule: number[] }) {
    const maxTarget = Math.max(...schedule);
    const max = Math.max(maxTarget, ...days.map(d => d.hours), 1);
    return (
        <div className="flex items-end gap-1.5 h-32">
            {days.map(d => {
                const dt = new Date(d.date);
                const dayIdx = (dt.getDay() + 6) % 7;
                const target = schedule[dayIdx] ?? 0;
                const isOffDay = target === 0;
                const heightPct = (d.hours / max) * 100;
                const targetPct = (target / max) * 100;
                const dayLabel = dt.toLocaleDateString('de-AT', { weekday: 'short' });
                return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {d.hours > 0 ? formatHours(d.hours) : ''}
                        </div>
                        <div className="relative w-full flex items-end" style={{ height: 80 }}>
                            {target > 0 && (
                                <div className="absolute left-0 right-0 border-t-2 border-dashed" style={{ bottom: `${targetPct}%`, borderColor: 'var(--text-muted)', opacity: 0.4 }} />
                            )}
                            <div className="w-full rounded-t transition-all" style={{
                                height: `${heightPct}%`,
                                background: isOffDay ? 'var(--border-default)' : d.hours >= target ? '#10B981' : 'var(--accent)',
                                opacity: isOffDay ? 0.5 : 1,
                            }} title={`${d.hours}h ${target > 0 ? `(Soll: ${formatHours(target)}h)` : '(frei)'}`} />
                        </div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: isOffDay ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{dayLabel}</div>
                        <div className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{dt.getDate()}.</div>
                    </div>
                );
            })}
        </div>
    );
}

function ProjectBars({ projects, total }: { projects: { projectId: string; projectTitle: string; clientName?: string; hours: number; pct: number }[]; total: number }) {
    const max = Math.max(...projects.map(p => p.hours), 1);
    return (
        <div className="space-y-2.5">
            {projects.map(p => (
                <div key={p.projectId}>
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {p.projectTitle}
                            {p.clientName && <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>· {p.clientName}</span>}
                        </span>
                        <span className="text-xs tabular-nums shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
                            {formatHours(p.hours)} h <span style={{ color: 'var(--text-muted)' }}>({Math.round(p.pct * 100)}%)</span>
                        </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                        <div className="h-full transition-all" style={{ width: `${(p.hours / max) * 100}%`, background: 'var(--accent)' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Helpers ──
function formatHours(h: number): string {
    if (Number.isInteger(h)) return String(h);
    return h.toFixed(1).replace('.', ',');
}

function fmtClock(iso?: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function defaultSchedule(weeklyHours?: number): number[] {
    const h = weeklyHours && weeklyHours > 0 ? weeklyHours / 5 : 8;
    return [h, h, h, h, h, 0, 0];
}

function endOfToday(): Date {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
}

function getWeekNumber(d: Date): number {
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
    const week1 = new Date(target.getFullYear(), 0, 4);
    return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
