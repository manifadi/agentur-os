'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Users, User, BarChart3, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';
import { TimeEntry, Employee } from '../../types';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    isoDate, formatRangeLabel, aggregatePeriod, buildCsv, downloadCsv,
} from '../../utils/reporting';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import UserAvatar from '../UI/UserAvatar';
import { useLocalStorage } from '../../hooks/useLocalStorage';

type RangeMode = 'week' | 'month';
type Scope = 'me' | 'team';

interface Props {
    currentUser: Employee;
}

export default function ReportingPage({ currentUser }: Props) {
    const { employees, projects } = useApp();
    const isAdmin = currentUser.role === 'admin';

    const [rangeMode, setRangeMode] = useLocalStorage<RangeMode>('reporting:rangeMode', 'week');
    const [scope, setScope] = useLocalStorage<Scope>('reporting:scope', 'me');
    const [anchor, setAnchor] = useState(new Date());

    // Derived range
    const { from, to } = useMemo(() => {
        if (rangeMode === 'week') return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
        return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    }, [rangeMode, anchor]);

    const orgId = currentUser.organization_id;
    const meId = currentUser.id;

    // ── Time-entries Realtime ──
    const fromIso = useMemo(() => isoDate(from), [from]);
    const toIso = useMemo(() => isoDate(to), [to]);

    // time_entries hat keinen org-Spalte → keine effiziente Realtime-Subscription möglich.
    // Stattdessen: nur initial-Fetch + bei Range/Scope-Change. RLS sorgt für Org-Isolation.
    const entriesQuery = useRealtimeTable<TimeEntry>({
        table: 'time_entries',
        filter: null, // subscription disabled
        enabled: !!orgId,
        fetchFn: async () => {
            if (!orgId) return [];
            let q = supabase.from('time_entries')
                .select('*, projects(id, title, job_number, clients(id, name)), positions:agency_positions(id, title)')
                .gte('date', fromIso)
                .lte('date', toIso);
            if (scope === 'me') q = q.eq('employee_id', meId);
            const { data } = await q;
            return (data as TimeEntry[]) || [];
        },
        deps: [orgId, fromIso, toIso, scope, meId],
    });

    const entries = entriesQuery.data;

    // ── Navigation ──
    const navigate = (dir: -1 | 1) => {
        const d = new Date(anchor);
        if (rangeMode === 'week') d.setDate(d.getDate() + dir * 7);
        else d.setMonth(d.getMonth() + dir);
        setAnchor(d);
    };

    const goNow = () => setAnchor(new Date());

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-app)' }}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center gap-4 shrink-0" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>Reporting</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Stunden, Projekte & Soll/Ist
                    </p>
                </div>

                {/* Scope toggle (admin only) */}
                {isAdmin && (
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
                        <button onClick={() => setScope('me')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                            style={scope === 'me' ? { background: 'var(--accent)', color: 'var(--accent-text)' } : { color: 'var(--text-muted)' }}
                        >
                            <User size={12} /> Ich
                        </button>
                        <button onClick={() => setScope('team')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                            style={scope === 'team' ? { background: 'var(--accent)', color: 'var(--accent-text)' } : { color: 'var(--text-muted)' }}
                        >
                            <Users size={12} /> Team
                        </button>
                    </div>
                )}

                {/* Range toggle */}
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
                    {(['week', 'month'] as RangeMode[]).map(r => (
                        <button key={r} onClick={() => setRangeMode(r)}
                            className="px-3 py-1.5 text-xs font-semibold transition-all"
                            style={rangeMode === r ? { background: 'var(--accent)', color: 'var(--accent-text)' } : { color: 'var(--text-muted)' }}
                        >
                            {r === 'week' ? 'Woche' : 'Monat'}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={16} /></button>
                    <button onClick={goNow} className="px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                        {rangeMode === 'week' ? 'Diese Woche' : 'Dieser Monat'}
                    </button>
                    <button onClick={() => navigate(1)} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}><ChevronRight size={16} /></button>
                </div>
            </div>

            {/* Range Label */}
            <div className="px-6 py-2 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <Calendar size={12} />
                <span className="font-semibold">{formatRangeLabel(from, to)}</span>
                <span>·</span>
                <span>{entries.length} Buchungen</span>
                {entriesQuery.loading && <span className="ml-auto italic">Lade…</span>}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
                {scope === 'me' ? (
                    <SoloReport
                        currentUser={currentUser}
                        entries={entries}
                        from={from}
                        to={to}
                        rangeMode={rangeMode}
                        projects={projects}
                    />
                ) : (
                    <TeamReport
                        employees={employees.filter(e => e.organization_id === orgId)}
                        entries={entries}
                        from={from}
                        to={to}
                        rangeMode={rangeMode}
                        projects={projects}
                    />
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Solo-Report (ein Mitarbeiter)
// ─────────────────────────────────────────────────────────────────────
interface SoloProps {
    currentUser: Employee;
    entries: TimeEntry[];
    from: Date;
    to: Date;
    rangeMode: RangeMode;
    projects: any[];
}

function SoloReport({ currentUser, entries, from, to, rangeMode, projects }: SoloProps) {
    const schedule = currentUser.weekly_schedule || defaultSchedule(currentUser.weekly_hours);
    const weeklyTarget = schedule.reduce((s, h) => s + h, 0);
    const stats = useMemo(
        () => aggregatePeriod(entries, from, to, schedule, projects),
        [entries, from, to, schedule, projects],
    );

    const handleExport = () => {
        const csv = buildCsv(entries, currentUser, projects);
        const label = rangeMode === 'week' ? `KW${getWeekNumber(from)}` : from.toLocaleDateString('de-AT', { year: 'numeric', month: '2-digit' }).replace('/', '-');
        downloadCsv(csv, `zeiterfassung_${currentUser.name.replace(/\s+/g, '_')}_${label}.csv`);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Erfasst" value={`${formatHours(stats.totalHours)} h`} sub={`${entries.length} Buchungen`} />
                <KpiCard label="Soll" value={`${formatHours(stats.targetHours)} h`} sub={`${weeklyTarget}h / Woche`} />
                <KpiCard
                    label="Differenz"
                    value={`${stats.deltaHours >= 0 ? '+' : ''}${formatHours(stats.deltaHours)} h`}
                    sub={`${stats.deltaPct >= 0 ? '+' : ''}${Math.round(stats.deltaPct * 100)}%`}
                    tone={stats.deltaHours >= 0 ? 'positive' : 'negative'}
                />
            </div>

            {/* Daily bars */}
            <Card title="Tages-Verteilung" right={
                <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                >
                    <Download size={12} /> CSV-Export
                </button>
            }>
                <DayBars days={stats.days} schedule={schedule} />
            </Card>

            {/* Projects */}
            <Card title="Projekt-Verteilung">
                {stats.projects.length === 0 ? (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Keine Buchungen in diesem Zeitraum.</p>
                ) : (
                    <ProjectBars projects={stats.projects} total={stats.totalHours} />
                )}
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Team-Report (alle Mitarbeiter)
// ─────────────────────────────────────────────────────────────────────
interface TeamProps {
    employees: Employee[];
    entries: TimeEntry[];
    from: Date;
    to: Date;
    rangeMode: RangeMode;
    projects: any[];
}

function TeamReport({ employees, entries, from, to, rangeMode, projects }: TeamProps) {
    const rows = useMemo(() => employees.map(emp => {
        const empEntries = entries.filter(e => e.employee_id === emp.id);
        const schedule = emp.weekly_schedule || defaultSchedule(emp.weekly_hours);
        const stats = aggregatePeriod(empEntries, from, to, schedule, projects);
        return { emp, stats, entries: empEntries };
    }).sort((a, b) => b.stats.totalHours - a.stats.totalHours), [employees, entries, from, to, projects]);

    const teamTotal = rows.reduce((s, r) => s + r.stats.totalHours, 0);
    const teamTarget = rows.reduce((s, r) => s + r.stats.targetHours, 0);

    const handleExportAll = () => {
        const allRows: string[][] = [['Datum', 'Mitarbeiter', 'Projekt', 'Kunde', 'Stunden', 'Beschreibung']];
        const projById = new Map(projects.map(p => [p.id, p]));
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
        for (const e of sorted) {
            const emp = employees.find(em => em.id === e.employee_id);
            const proj = e.projects || projById.get(e.project_id);
            allRows.push([
                e.date.slice(0, 10),
                emp?.name || '',
                proj?.title || '',
                (proj as any)?.clients?.name || '',
                String(e.hours).replace('.', ','),
                (e.description || '').replace(/\n/g, ' '),
            ]);
        }
        const csv = allRows.map(r => r.map(v => /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(';')).join('\r\n');
        const label = rangeMode === 'week' ? `KW${getWeekNumber(from)}` : from.toLocaleDateString('de-AT', { year: 'numeric', month: '2-digit' }).replace('/', '-');
        downloadCsv(csv, `zeiterfassung_team_${label}.csv`);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Team-KPIs */}
            <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Team-Stunden" value={`${formatHours(teamTotal)} h`} sub={`${employees.length} Mitarbeiter`} />
                <KpiCard label="Team-Soll" value={`${formatHours(teamTarget)} h`} sub="kumuliert" />
                <KpiCard
                    label="Auslastung"
                    value={teamTarget > 0 ? `${Math.round((teamTotal / teamTarget) * 100)}%` : '–'}
                    sub={`${formatHours(teamTotal - teamTarget)} h Differenz`}
                    tone={teamTotal >= teamTarget ? 'positive' : 'negative'}
                />
            </div>

            <Card title="Mitarbeiter-Übersicht" right={
                <button onClick={handleExportAll} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                >
                    <Download size={12} /> Team-CSV
                </button>
            }>
                <div className="space-y-2">
                    {rows.map(({ emp, stats, entries: empEntries }) => (
                        <TeamRow key={emp.id} emp={emp} stats={stats} entries={empEntries} projects={projects} rangeMode={rangeMode} from={from} />
                    ))}
                </div>
            </Card>
        </div>
    );
}

function TeamRow({ emp, stats, entries, projects, rangeMode, from }: { emp: Employee; stats: ReturnType<typeof aggregatePeriod>; entries: TimeEntry[]; projects: any[]; rangeMode: RangeMode; from: Date }) {
    const [expanded, setExpanded] = useState(false);
    const fillPct = stats.targetHours > 0 ? Math.min(stats.totalHours / stats.targetHours, 1.5) : 0;
    const overTarget = stats.totalHours > stats.targetHours;

    const handleExport = (e: React.MouseEvent) => {
        e.stopPropagation();
        const csv = buildCsv(entries, emp, projects);
        const label = rangeMode === 'week' ? `KW${getWeekNumber(from)}` : from.toLocaleDateString('de-AT', { year: 'numeric', month: '2-digit' }).replace('/', '-');
        downloadCsv(csv, `zeiterfassung_${emp.name.replace(/\s+/g, '_')}_${label}.csv`);
    };

    return (
        <div className="rounded-xl transition-colors" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <button onClick={() => setExpanded(x => !x)} className="w-full p-3 flex items-center gap-3 text-left">
                <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="sm" />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{emp.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{emp.job_title || emp.email}</div>
                </div>

                <div className="hidden md:flex items-center gap-1.5 w-40">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                        <div className="h-full transition-all" style={{
                            width: `${fillPct * 100}%`,
                            background: overTarget ? '#10B981' : 'var(--accent)',
                        }} />
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {Math.round(fillPct * 100)}%
                    </span>
                </div>

                <div className="text-right tabular-nums">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {formatHours(stats.totalHours)} <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>/ {formatHours(stats.targetHours)} h</span>
                    </div>
                    <div className="text-[10px]" style={{ color: overTarget ? '#10B981' : '#EF4444' }}>
                        {stats.deltaHours >= 0 ? '+' : ''}{formatHours(stats.deltaHours)} h
                    </div>
                </div>

                <button onClick={handleExport}
                    className="p-1.5 rounded-lg shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    title="CSV für diesen Mitarbeiter"
                >
                    <Download size={13} />
                </button>
            </button>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    {stats.projects.length === 0 ? (
                        <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>Keine Buchungen.</p>
                    ) : (
                        <ProjectBars projects={stats.projects} total={stats.totalHours} />
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
//  Shared UI primitives
// ─────────────────────────────────────────────────────────────────────

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
                const dayIdx = (dt.getDay() + 6) % 7; // Mo=0
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
                            {/* Target line — nur an arbeitstagen */}
                            {target > 0 && (
                                <div className="absolute left-0 right-0 border-t-2 border-dashed" style={{ bottom: `${targetPct}%`, borderColor: 'var(--text-muted)', opacity: 0.4 }} />
                            )}
                            <div className="w-full rounded-t transition-all" style={{
                                height: `${heightPct}%`,
                                background: isOffDay ? 'var(--border-default)' : d.hours >= target ? '#10B981' : 'var(--accent)',
                                opacity: isOffDay ? 0.5 : 1,
                            }} title={`${d.hours}h ${target > 0 ? `(Soll: ${formatHours(target)}h)` : '(frei)'}`} />
                        </div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: isOffDay ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                            {dayLabel}
                        </div>
                        <div className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {dt.getDate()}.
                        </div>
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
                        <div className="h-full transition-all" style={{
                            width: `${(p.hours / max) * 100}%`,
                            background: 'var(--accent)',
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Helpers
function formatHours(h: number): string {
    if (Number.isInteger(h)) return String(h);
    return h.toFixed(1).replace('.', ',');
}

function defaultSchedule(weeklyHours?: number): number[] {
    const h = weeklyHours && weeklyHours > 0 ? weeklyHours / 5 : 8;
    return [h, h, h, h, h, 0, 0];
}

function getWeekNumber(d: Date): number {
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
    const week1 = new Date(target.getFullYear(), 0, 4);
    return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
