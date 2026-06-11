import React, { useState, useRef, useMemo } from 'react';
import { Plus, Trash2, X, Home } from 'lucide-react';
import { Project, Client, ResourceAllocation, AllocationRow, Absence, AbsenceType, ABSENCE_TYPE_COLOR, ABSENCE_TYPE_LABEL } from '../../types';
import UserAvatar from '../UI/UserAvatar';
import AbsenceIcon from '../Absences/AbsenceIcon';
import { isDateCovered } from '../../utils/absences';
import { ALLOCATION_STATUS_OPTIONS, getStatusConfig, dayCapacity } from './shared';

// Consistent project color from ID hash
const PALETTE = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-rose-500', 'bg-amber-400', 'bg-teal-500', 'bg-fuchsia-500',
];
function projectColor(id: string) {
    const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return PALETTE[h % PALETTE.length];
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

// ─── Props ────────────────────────────────────────────────────────────────────
interface ResourceCardsProps {
    rows: AllocationRow[];
    projects: Project[];
    allClients: Client[];
    absences?: Absence[];
    weekStart?: string; // YYYY-MM-DD Montag
    onToggleHomeoffice?: (employeeId: string, isoDate: string, existing: Absence | null) => Promise<void>;
    onUpdateAllocation: (id: string, field: string, value: any) => Promise<void>;
    onCreateAllocation: (employeeId: string, data: { type: 'existing'; projectId: string } | { type: 'new'; clientName: string; projectTitle: string }) => Promise<void>;
    onDeleteAllocation: (id: string) => void;
}

// Hilfsfunktion: liefert pro Wochentag (Mo–Fr) die dominante Abwesenheit
// (vollständiges Absence-Objekt, damit Stornieren möglich ist) oder null.
// Priorität: vacation > sick > other > home_office.
function buildAbsenceMap(employeeId: string, weekStart: string | undefined, absences: Absence[]): (Absence | null)[] {
    const out: (Absence | null)[] = [null, null, null, null, null];
    if (!weekStart) return out;
    const monday = new Date(weekStart);
    const priority: Record<AbsenceType, number> = { vacation: 0, unpaid_vacation: 1, zeitausgleich: 2, sick: 3, other: 4, home_office: 5 };
    for (let i = 0; i < 5; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        const dayAbsences = absences.filter(a =>
            a.employee_id === employeeId
            && a.status === 'approved'
            && isDateCovered(day, a)
        );
        if (dayAbsences.length === 0) continue;
        dayAbsences.sort((a, b) => priority[a.type] - priority[b.type]);
        out[i] = dayAbsences[0];
    }
    return out;
}

// Datum für Tag-Index (0=Mo..4=Fr) basierend auf weekStart
function dateForDay(weekStart: string, dayIdx: number): string {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIdx);
    return d.toISOString().slice(0, 10);
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function ResourceCards({ rows, projects, allClients, absences = [], weekStart, onToggleHomeoffice, onUpdateAllocation, onCreateAllocation, onDeleteAllocation }: ResourceCardsProps) {
    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-text-muted text-sm">
                Keine Mitarbeiter in dieser Abteilung.
            </div>
        );
    }

    return (
        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-none">
            {rows.map(row => (
                <EmployeeCard
                    key={row.employee.id}
                    row={row}
                    projects={projects}
                    allClients={allClients}
                    absenceMap={buildAbsenceMap(row.employee.id, weekStart, absences)}
                    weekStart={weekStart}
                    onToggleHomeoffice={onToggleHomeoffice}
                    onUpdateAllocation={onUpdateAllocation}
                    onCreateAllocation={onCreateAllocation}
                    onDeleteAllocation={onDeleteAllocation}
                />
            ))}
        </div>
    );
}

// ─── Employee card ────────────────────────────────────────────────────────────
function EmployeeCard({ row, projects, allClients, absenceMap, weekStart, onToggleHomeoffice, onUpdateAllocation, onCreateAllocation, onDeleteAllocation }: {
    row: AllocationRow;
    projects: Project[];
    allClients: Client[];
    absenceMap: (Absence | null)[];
    weekStart?: string;
    onToggleHomeoffice?: (employeeId: string, isoDate: string, existing: Absence | null) => Promise<void>;
    onUpdateAllocation: (id: string, field: string, value: any) => Promise<void>;
    onCreateAllocation: (uid: string, data: any) => Promise<void>;
    onDeleteAllocation: (id: string) => void;
}) {
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [showNewModal, setShowNewModal] = useState(false);
    const selRef = useRef(false);

    // Per-day totals for capacity bars
    const dayTotals = DAYS.map(d => row.allocations.reduce((s, a) => s + ((a as any)[d] || 0), 0));
    const weekTotal = dayTotals.reduce((s, v) => s + v, 0);
    // Tages-Soll-Kapazität aus dem Wochenplan des Mitarbeiters (Admin-gepflegt).
    const dayCaps = DAYS.map((_, i) => dayCapacity(row.employee, i));
    const weekCap = dayCaps.reduce((s, v) => s + v, 0);
    const anyDayOver = dayTotals.some((t, i) => t > dayCaps[i]);
    const empOver = anyDayOver || weekTotal > weekCap;

    const filteredProjects = useMemo(() => {
        if (search.length < 2) return [];
        return projects
            .filter(p => p.job_number && (
                p.title.toLowerCase().includes(search.toLowerCase()) ||
                p.job_number.toLowerCase().includes(search.toLowerCase()) ||
                p.clients?.name?.toLowerCase().includes(search.toLowerCase())
            ))
            .slice(0, 7);
    }, [search, projects]);

    const handleSelect = (proj: Project) => {
        selRef.current = true;
        onCreateAllocation(row.employee.id, { type: 'existing', projectId: proj.id });
        setSearch(''); setShowDropdown(false); setShowAdd(false);
        setTimeout(() => { selRef.current = false; }, 300);
    };

    const handleSearchBlur = () => {
        setTimeout(() => {
            setShowDropdown(false);
            if (selRef.current || !search.trim()) return;
            const exact = projects.find(p => p.job_number && p.title.toLowerCase() === search.trim().toLowerCase());
            if (exact) { onCreateAllocation(row.employee.id, { type: 'existing', projectId: exact.id }); setSearch(''); setShowAdd(false); }
            else { setShowNewModal(true); }
        }, 200);
    };

    return (
        <div className="bg-surface rounded-2xl border border-default shadow-sm flex flex-col overflow-hidden">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar src={row.employee.avatar_url} name={row.employee.name} initials={row.employee.initials} size="sm" />
                    <div className="min-w-0">
                        <div className="font-bold text-sm text-text-primary truncate">{row.employee.name}</div>
                        {row.employee.job_title && (
                            <div className="text-[10px] text-text-muted uppercase tracking-wide font-medium">{row.employee.job_title}</div>
                        )}
                    </div>
                </div>
                <div className={`text-xs font-bold tabular-nums shrink-0 ml-2 ${empOver ? 'text-red-500' : 'text-text-secondary'}`} title={empOver ? 'Mehr Stunden eingetragen als Soll-Kapazität' : undefined}>
                    ∑ {weekTotal}h
                </div>
            </div>

            {/* ── Capacity bars ── */}
            <div className="px-4 pb-3">
                <div className="grid grid-cols-5 gap-1.5">
                    {DAYS.map((day, i) => {
                        const total = dayTotals[i];
                        const cap = dayCaps[i];
                        const over = total > cap;
                        const denom = cap > 0 ? cap : Math.max(total, 1);
                        const pct = Math.min((total / denom) * 100, 100);
                        const segments = row.allocations
                            .map(a => ({ color: projectColor(a.project_id), h: (a as any)[day] || 0 }))
                            .filter(s => s.h > 0);

                        const absence       = absenceMap[i];
                        const absenceType   = absence?.type ?? null;
                        const absenceColor  = absenceType ? ABSENCE_TYPE_COLOR[absenceType] : null;
                        const blocksCapacity = absenceType === 'vacation' || absenceType === 'unpaid_vacation' || absenceType === 'sick' || absenceType === 'other';
                        const isHomeoffice  = absenceType === 'home_office';

                        // Quick-Toggle nur möglich wenn entweder leer oder homeoffice
                        const canToggleHO = onToggleHomeoffice && weekStart && (!absenceType || isHomeoffice);

                        const handleHomeoffice = () => {
                            if (!canToggleHO || !weekStart) return;
                            const isoDate = dateForDay(weekStart, i);
                            onToggleHomeoffice!(row.employee.id, isoDate, isHomeoffice ? absence : null);
                        };

                        return (
                            <div key={day} className="group">
                                <div className="flex justify-between items-baseline mb-1 min-h-[14px]">
                                    <span className="text-[9px] font-bold text-text-muted">{DAY_LABELS[i]}</span>

                                    {/* Rechte Seite: entweder Total-h, Absence-Icon oder Quick-Toggle */}
                                    {absenceType && !isHomeoffice ? (
                                        <span
                                            className="inline-flex items-center"
                                            title={ABSENCE_TYPE_LABEL[absenceType]}
                                            style={{ color: absenceColor!.fg }}
                                        >
                                            <AbsenceIcon type={absenceType} size={11} />
                                        </span>
                                    ) : isHomeoffice ? (
                                        // Aktiver Homeoffice-Tag — Klick entfernt
                                        <button
                                            type="button"
                                            onClick={handleHomeoffice}
                                            title="Homeoffice entfernen"
                                            className="inline-flex items-center rounded-md p-0.5 transition"
                                            style={{ color: absenceColor!.fg, background: absenceColor!.bg }}
                                        >
                                            <Home size={10} strokeWidth={2} />
                                        </button>
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <span className={`text-[9px] font-bold tabular-nums ${over ? 'text-red-500' : total > 0 ? 'text-text-secondary' : 'text-text-placeholder'}`}>
                                                {total > 0 ? `${total}h` : '—'}
                                            </span>
                                            {/* Hover-Toggle: Homeoffice setzen */}
                                            {onToggleHomeoffice && weekStart && (
                                                <button
                                                    type="button"
                                                    onClick={handleHomeoffice}
                                                    title="Homeoffice eintragen"
                                                    className="opacity-0 group-hover:opacity-100 transition rounded-md p-0.5"
                                                    style={{ color: 'var(--text-muted)' }}
                                                    onMouseEnter={e => {
                                                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                                                        (e.currentTarget as HTMLElement).style.background = '';
                                                    }}
                                                >
                                                    <Home size={10} strokeWidth={2} />
                                                </button>
                                            )}
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="h-1.5 rounded-full overflow-hidden flex relative"
                                    style={{
                                        background: blocksCapacity ? absenceColor!.bg : 'var(--bg-subtle)',
                                    }}
                                >
                                    {!blocksCapacity && segments.map((seg, si) => (
                                        <div
                                            key={si}
                                            className={`h-full ${seg.color} ${si > 0 ? 'ml-px' : ''} transition-all duration-300`}
                                            style={{ width: `${Math.min((seg.h / denom) * 100, 100 / segments.length)}%` }}
                                        />
                                    ))}
                                    {!blocksCapacity && total > 0 && segments.length === 0 && (
                                        <div className="h-full bg-accent/50 rounded-full" style={{ width: `${pct}%` }} />
                                    )}
                                    {blocksCapacity && (
                                        <div className="h-full" style={{ width: '100%', background: absenceColor!.border }} />
                                    )}
                                </div>

                                {/* Homeoffice-Strip unter dem normalen Balken */}
                                {isHomeoffice && (
                                    <div className="h-0.5 mt-0.5 rounded-full" style={{ background: absenceColor!.border }} />
                                )}
                                {over && !blocksCapacity && (
                                    <div className="text-[8px] text-red-500 font-bold mt-0.5">+{(total - cap).toFixed(1)}h</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Allocation rows ── */}
            {row.allocations.length > 0 && (
                <div className="border-t border-default flex-1">
                    {row.allocations.map((alloc, idx) => (
                        <AllocationRow
                            key={alloc.id}
                            alloc={alloc}
                            color={projectColor(alloc.project_id)}
                            isLast={idx === row.allocations.length - 1}
                            onUpdate={onUpdateAllocation}
                            onDelete={onDeleteAllocation}
                        />
                    ))}
                </div>
            )}

            {/* ── Add project ── */}
            <div className={`border-t border-default px-4 py-2.5 ${showAdd ? 'bg-subtle/50' : ''}`}>
                {showAdd ? (
                    <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                autoFocus
                                className="w-full text-sm bg-surface border border-default rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-text-placeholder text-text-primary transition-all"
                                placeholder="Projekt suchen oder neu anlegen..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                                onBlur={handleSearchBlur}
                                onKeyDown={e => { if (e.key === 'Escape') { setShowAdd(false); setSearch(''); } }}
                            />
                            {showDropdown && search.length >= 2 && (
                                <div className="absolute bottom-full left-0 w-full bg-surface border border-default rounded-xl shadow-xl mb-1 overflow-hidden z-50">
                                    {filteredProjects.map(proj => (
                                        <button
                                            key={proj.id}
                                            className="w-full text-left px-3 py-2.5 hover:bg-hover border-b border-default last:border-none flex flex-col gap-0.5 transition-colors"
                                            onMouseDown={() => handleSelect(proj)}
                                        >
                                            <span className="text-xs font-semibold text-text-primary">{proj.title}</span>
                                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                                <span className="font-mono">{proj.job_number}</span>
                                                {proj.clients?.name && <span>· {proj.clients.name}</span>}
                                            </div>
                                        </button>
                                    ))}
                                    {filteredProjects.length === 0 && (
                                        <button
                                            className="w-full text-left px-3 py-2.5 text-xs text-text-secondary hover:bg-hover flex items-center gap-2 transition-colors"
                                            onMouseDown={() => { setShowDropdown(false); setShowNewModal(true); }}
                                        >
                                            <Plus size={12} className="shrink-0" />
                                            <span>„{search}" als neues Projekt anlegen</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={() => { setShowAdd(false); setSearch(''); }} className="text-text-muted hover:text-text-primary transition-colors p-1">
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors py-0.5 w-full group"
                    >
                        <Plus size={13} className="group-hover:scale-110 transition-transform" />
                        Projekt hinzufügen
                    </button>
                )}
            </div>

            {showNewModal && (
                <NewProjectModal
                    projectTitle={search}
                    allClients={allClients}
                    onSave={(clientName) => {
                        onCreateAllocation(row.employee.id, { type: 'new', clientName, projectTitle: search });
                        setShowNewModal(false); setSearch(''); setShowAdd(false);
                    }}
                    onCancel={() => { setShowNewModal(false); setSearch(''); setShowAdd(false); }}
                />
            )}
        </div>
    );
}

// ─── Single allocation inside a card ─────────────────────────────────────────
function AllocationRow({ alloc, color, isLast, onUpdate, onDelete }: {
    alloc: ResourceAllocation;
    color: string;
    isLast: boolean;
    onUpdate: (id: string, field: string, value: any) => Promise<void>;
    onDelete: (id: string) => void;
}) {
    const allocTotal = DAYS.reduce((s, d) => s + ((alloc as any)[d] || 0), 0);
    const taskRef = useRef<NodeJS.Timeout | null>(null);
    const [task, setTask] = useState(alloc.task_description || '');

    React.useEffect(() => { setTask(alloc.task_description || ''); }, [alloc.task_description]);

    const saveTask = (val: string) => {
        if (taskRef.current) clearTimeout(taskRef.current);
        taskRef.current = setTimeout(() => { if (val !== alloc.task_description) onUpdate(alloc.id, 'task_description', val); }, 1500);
    };

    return (
        <div className={`px-4 py-3 group/row hover:bg-subtle/40 transition-colors ${!isLast ? 'border-b border-default' : ''}`}>
            {/* Project title + status + delete */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${color}`} />
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-text-primary truncate block">{alloc.projects?.title || '—'}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-muted">
                            {alloc.projects?.clients?.name && <span className="truncate">{alloc.projects.clients.name}</span>}
                            {alloc.projects?.job_number && <span className="font-mono opacity-70">· {alloc.projects.job_number}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <select
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg border-none outline-none cursor-pointer ${getStatusConfig(alloc.allocation_status).badge}`}
                        value={alloc.allocation_status || 'Geplant'}
                        onChange={e => onUpdate(alloc.id, 'allocation_status', e.target.value)}
                    >
                        {ALLOCATION_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                        onClick={() => onDelete(alloc.id)}
                        className="text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover/row:opacity-100 p-0.5 ml-0.5"
                    >
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>

            {/* Task description */}
            <input
                className="w-full text-[11px] text-text-secondary bg-transparent outline-none placeholder:text-text-placeholder focus:text-text-primary mb-2 transition-colors"
                placeholder="Aufgabe beschreiben..."
                value={task}
                onChange={e => { setTask(e.target.value); saveTask(e.target.value); }}
                onBlur={() => { if (taskRef.current) clearTimeout(taskRef.current); if (task !== alloc.task_description) onUpdate(alloc.id, 'task_description', task); }}
            />

            {/* Hours per day + weekly total */}
            <div className="flex items-center gap-2 flex-wrap">
                {DAYS.map((day, i) => {
                    const val = (alloc as any)[day] || 0;
                    return (
                        <CardHourInput
                            key={day}
                            label={DAY_LABELS[i]}
                            value={val}
                            onSave={v => onUpdate(alloc.id, day, v)}
                        />
                    );
                })}
                <span className="ml-auto text-[10px] font-bold text-text-muted tabular-nums">∑ {allocTotal}h</span>
            </div>
        </div>
    );
}

// ─── Compact hour input for cards ─────────────────────────────────────────────
function CardHourInput({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
    const [focused, setFocused] = useState(false);
    const [local, setLocal] = useState(value > 0 ? String(value) : '');

    // Sync when value changes externally (not while editing)
    React.useEffect(() => {
        if (!focused) setLocal(value > 0 ? String(value) : '');
    }, [value, focused]);

    const commit = () => {
        const v = parseFloat(local) || 0;
        if (v !== value) onSave(v);
        setLocal(v > 0 ? String(v) : '');
        setFocused(false);
    };

    return (
        <div className="flex items-center gap-0.5">
            <span className="text-[9px] text-text-muted font-bold">{label}</span>
            <input
                type="number"
                min="0" max="24" step="0.5"
                className={`w-9 text-center text-[11px] font-bold rounded-lg outline-none transition-all
                    ${focused
                        ? 'bg-accent/10 text-accent ring-1 ring-accent/30'
                        : value > 0
                            ? 'bg-subtle text-text-primary hover:bg-hover'
                            : 'bg-transparent text-text-muted/40 hover:bg-subtle'
                    }`}
                value={focused ? local : (value > 0 ? value : '')}
                placeholder="—"
                onFocus={() => { setFocused(true); setLocal(value > 0 ? String(value) : ''); }}
                onChange={e => setLocal(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
            />
        </div>
    );
}

// ─── New project modal ────────────────────────────────────────────────────────
function NewProjectModal({ projectTitle, allClients, onSave, onCancel }: {
    projectTitle: string;
    allClients: Client[];
    onSave: (clientName: string) => void;
    onCancel: () => void;
}) {
    const [localClient, setLocalClient] = useState('');
    const [showClientSearch, setShowClientSearch] = useState(false);

    const filteredClients = useMemo(() => {
        if (!localClient) return [];
        return allClients.filter(c => c.name.toLowerCase().includes(localClient.toLowerCase())).slice(0, 5);
    }, [localClient, allClients]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl shadow-2xl border border-default p-8 w-full max-w-sm m-4 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-1 text-text-primary">Neues Projekt anlegen</h3>
                <p className="text-sm text-text-secondary mb-6">Jobnummer wird automatisch vergeben.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Projekttitel</label>
                        <div className="w-full border border-default rounded-xl px-4 py-2.5 text-sm text-text-secondary bg-subtle font-medium truncate">
                            {projectTitle || '—'}
                        </div>
                    </div>
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Kunde</label>
                        <input
                            autoFocus
                            className="w-full border border-default rounded-xl px-4 py-2.5 text-sm text-text-primary bg-subtle focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
                            placeholder="Kunden suchen oder neu anlegen..."
                            value={localClient}
                            onChange={e => { setLocalClient(e.target.value); setShowClientSearch(true); }}
                            onFocus={() => setShowClientSearch(true)}
                        />
                        {showClientSearch && filteredClients.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-surface shadow-xl border border-default rounded-xl mt-1 z-50 overflow-hidden">
                                {filteredClients.map(c => (
                                    <button key={c.id} className="w-full text-left px-4 py-2 hover:bg-hover border-b border-default last:border-none text-sm text-text-primary font-medium" onClick={() => { setLocalClient(c.name); setShowClientSearch(false); }}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onCancel} className="px-5 py-2.5 text-sm font-bold text-text-secondary hover:bg-hover rounded-xl transition-colors">Abbrechen</button>
                    <button
                        onClick={() => onSave(localClient)}
                        disabled={!localClient.trim()}
                        className="px-6 py-2.5 text-sm font-bold bg-text-primary text-surface hover:opacity-90 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        Anlegen
                    </button>
                </div>
            </div>
        </div>
    );
}
