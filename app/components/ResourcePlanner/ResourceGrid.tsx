import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Plus, Search, X, Home } from 'lucide-react';
import { Employee, Project, Client, ResourceAllocation, AllocationRow, Absence, AbsenceType, ABSENCE_TYPE_COLOR, ABSENCE_TYPE_LABEL } from '../../types';
import AbsenceIcon from '../Absences/AbsenceIcon';
import { isDateCovered } from '../../utils/absences';
import { ALLOCATION_STATUS_OPTIONS, STATUS_CONFIG, getStatusConfig, dayCapacity } from './shared';

// ─── Capacity helpers ───────────────────────────────────────────────────────────
// Farbgebung relativ zur Tages-Soll-Kapazität: rot sobald mehr eingetragen ist,
// als der Mitarbeiter an dem Tag laut Wochenplan arbeitet.
function capacityTextColor(h: number, cap: number) {
    if (h === 0) return 'text-text-placeholder';
    if (h > cap) return 'text-red-500 dark:text-red-400 font-bold';
    return 'text-emerald-600 dark:text-emerald-400 font-bold';
}

function capacityBarColor(h: number, cap: number) {
    if (h === 0)  return 'bg-default/30';
    if (h > cap)  return 'bg-red-500';
    return 'bg-emerald-500';
}

// ─── Employee avatar ────────────────────────────────────────────────────────────
const AVATAR_BG = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-fuchsia-500'];
function avatarBg(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffff;
    return AVATAR_BG[h % AVATAR_BG.length];
}

// ─── DebouncedInput ─────────────────────────────────────────────────────────────
interface DebouncedInputProps {
    id: string;
    initialValue: string;
    onSave: (val: string) => void;
    placeholder?: string;
    className?: string;
    isTextarea?: boolean;
}

function DebouncedInput({ id, initialValue, onSave, placeholder, className, isTextarea }: DebouncedInputProps) {
    const [local, setLocal] = React.useState(initialValue);
    const timer = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => { setLocal(initialValue); }, [initialValue]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const v = e.target.value;
        setLocal(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { if (v !== initialValue) onSave(v); }, 5000);
    };

    const onBlur = () => {
        if (timer.current) clearTimeout(timer.current);
        if (local !== initialValue) onSave(local);
    };

    if (isTextarea) {
        return (
            <textarea
                className={`${className} resize-none py-1.5 leading-tight`}
                value={local || ''}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                rows={1}
            />
        );
    }

    return (
        <input
            type="text"
            className={className}
            value={local || ''}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
        />
    );
}

// ─── Hour cell with +/− buttons ─────────────────────────────────────────────────
function HourCell({ allocId, day, value, onSave }: { allocId: string; day: string; value: number; onSave: (v: number) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);

    const step = (delta: number) => {
        const cur = parseFloat(inputRef.current?.value || '0') || value;
        const next = Math.max(0, Math.min(24, Math.round((cur + delta) * 2) / 2));
        if (inputRef.current) inputRef.current.value = next > 0 ? String(next) : '';
        if (next !== value) onSave(next);
    };

    return (
        <div className="relative h-full flex items-center justify-center group/cell">
            <button
                className="absolute left-0.5 text-[11px] leading-none text-text-muted/40 hover:text-accent opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 select-none font-bold"
                onMouseDown={e => { e.preventDefault(); step(-0.5); }}
                tabIndex={-1}
            >−</button>
            <input
                ref={inputRef}
                key={`${allocId}-${day}-${value}`}
                type="number"
                min="0" max="24" step="0.5"
                className={`appearance-none w-8 h-full text-center bg-transparent focus:bg-accent/10 focus:outline-none font-bold block text-[12px] transition-colors ${value > 0 ? 'text-text-primary' : 'text-text-muted/25'}`}
                defaultValue={value || ''}
                placeholder="—"
                onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== value) onSave(v); }}
                onKeyDown={e => { if (e.key === 'Tab') (e.target as HTMLInputElement).blur(); }}
            />
            <button
                className="absolute right-0.5 text-[11px] leading-none text-text-muted/40 hover:text-accent opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 select-none font-bold"
                onMouseDown={e => { e.preventDefault(); step(0.5); }}
                tabIndex={-1}
            >+</button>
        </div>
    );
}

// ─── Props ──────────────────────────────────────────────────────────────────────
interface ResourceGridProps {
    rows: AllocationRow[];
    projects: Project[];
    employees: Employee[];
    weekNumber: number;
    year: number;
    absences?: Absence[];
    weekStart?: string;
    onUpdateAllocation: (id: string, field: string, value: any) => Promise<void>;
    onCreateAllocation: (employeeId: string, data: { type: 'existing'; projectId: string } | { type: 'new'; clientName: string; projectTitle: string }) => Promise<void>;
    onDeleteAllocation: (id: string) => void;
    onToggleHomeoffice?: (employeeId: string, isoDate: string, existing: Absence | null) => Promise<void>;
    allClients: Client[];
}

// Liefert pro Wochentag (Mo–Fr) die dominante Abwesenheit oder null.
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

function dateForDay(weekStart: string, dayIdx: number): string {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIdx);
    return d.toISOString().slice(0, 10);
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
// 12 columns: border | Projekt | Aufgabe | Status | Mo-Fr(5) | Σ | Anmerkung | ×
const COL_COUNT = 12 as const;

// ─── Main component ─────────────────────────────────────────────────────────────
export default function ResourceGrid({ rows, projects, absences = [], weekStart, onUpdateAllocation, onCreateAllocation, onDeleteAllocation, onToggleHomeoffice, allClients }: ResourceGridProps) {
    const globalTotals = useMemo(() => {
        const t = { mo: 0, di: 0, mi: 0, do: 0, fr: 0 };
        rows.forEach(r => r.allocations.forEach(a => {
            t.mo += a.monday || 0; t.di += a.tuesday || 0;
            t.mi += a.wednesday || 0; t.do += a.thursday || 0; t.fr += a.friday || 0;
        }));
        return t;
    }, [rows]);
    const globalTotal = Object.values(globalTotals).reduce((s, v) => s + v, 0);

    // Team-Soll-Kapazität pro Tag = Summe der Tageskapazitäten aller Mitarbeiter.
    const globalCaps = useMemo(
        () => DAYS.map((_, i) => rows.reduce((s, r) => s + dayCapacity(r.employee, i), 0)),
        [rows],
    );
    const globalWeekCap = globalCaps.reduce((s, v) => s + v, 0);
    const globalDayValues = [globalTotals.mo, globalTotals.di, globalTotals.mi, globalTotals.do, globalTotals.fr];
    const globalAnyOver = globalDayValues.some((v, i) => v > globalCaps[i]);

    return (
        <div className="overflow-x-auto max-h-[calc(100vh-140px)]">
            <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-subtle border-b border-default text-text-muted">
                    <tr className="h-9">
                        <th className="w-1 border-r border-default p-0"></th>
                        <th className="px-3 text-left font-bold uppercase tracking-wider text-[10px] border-r border-default w-64 min-w-[200px]">Projekt</th>
                        <th className="px-2 text-left font-bold uppercase tracking-wider text-[10px] border-r border-default w-44">Aufgabe</th>
                        <th className="px-2 text-center font-bold uppercase tracking-wider text-[10px] border-r border-default w-28">Status</th>
                        {DAY_LABELS.map(d => (
                            <th key={d} className="w-12 text-center font-bold text-[10px] border-r border-default text-accent bg-accent-subtle/20">
                                {d}<span className="text-[8px] font-normal opacity-50 ml-0.5">h</span>
                            </th>
                        ))}
                        <th className="w-10 text-center font-bold text-[10px] border-r border-default">Σ</th>
                        <th className="px-2 text-left font-bold uppercase tracking-wider text-[10px] border-r border-default w-36">Anmerkung</th>
                        <th className="w-8"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        const dayTotals = DAYS.map(d => row.allocations.reduce((s, a) => s + ((a as any)[d] || 0), 0));
                        const empTotal  = dayTotals.reduce((s, v) => s + v, 0);
                        const dayCaps   = DAYS.map((_, i) => dayCapacity(row.employee, i));
                        const weekCap   = dayCaps.reduce((s, v) => s + v, 0);
                        const anyDayOver = dayTotals.some((t, i) => t > dayCaps[i]);
                        const empOver   = anyDayOver || empTotal > weekCap;
                        const absenceMap = buildAbsenceMap(row.employee.id, weekStart, absences);

                        const handleHomeofficeFor = (i: number, existing: Absence | null) => {
                            if (!onToggleHomeoffice || !weekStart) return;
                            onToggleHomeoffice(row.employee.id, dateForDay(weekStart, i), existing);
                        };

                        return (
                            <React.Fragment key={row.employee.id}>
                                {/* ── Employee section header ── */}
                                <tr className="bg-subtle/70 border-y border-default">
                                    <td colSpan={COL_COUNT} className="pl-3 pr-4 py-2">
                                        <div className="flex items-center gap-3">
                                            {row.employee.avatar_url ? (
                                                <img src={row.employee.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-default" />
                                            ) : (
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarBg(row.employee.id)}`}>
                                                    {row.employee.initials || row.employee.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-bold text-sm text-text-primary">{row.employee.name}</span>
                                                    {row.employee.job_title && (
                                                        <span className="text-[10px] text-text-muted uppercase tracking-wide">{row.employee.job_title}</span>
                                                    )}
                                                    <span className="text-[10px] text-text-muted">
                                                        {row.allocations.length > 0 && `${row.allocations.length} Einträge`}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Per-day mini capacity bars + Abwesenheits-Toggle */}
                                            <div className="flex items-center gap-2.5">
                                                {dayTotals.map((v, i) => {
                                                    const cap = dayCaps[i];
                                                    const absence = absenceMap[i];
                                                    const absenceType = absence?.type ?? null;
                                                    const absenceColor = absenceType ? ABSENCE_TYPE_COLOR[absenceType] : null;
                                                    const isHomeoffice = absenceType === 'home_office';
                                                    const canToggleHO = onToggleHomeoffice && weekStart && (!absenceType || isHomeoffice);

                                                    return (
                                                        <div key={i} className="group flex flex-col items-center gap-1 min-w-[28px]">
                                                            {absenceType && !isHomeoffice ? (
                                                                <div
                                                                    className="w-6 h-3 rounded flex items-center justify-center"
                                                                    title={ABSENCE_TYPE_LABEL[absenceType]}
                                                                    style={{ background: absenceColor!.bg, color: absenceColor!.fg, border: `1px solid ${absenceColor!.border}` }}
                                                                >
                                                                    <AbsenceIcon type={absenceType} size={9} />
                                                                </div>
                                                            ) : isHomeoffice ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleHomeofficeFor(i, absence)}
                                                                    title="Homeoffice entfernen"
                                                                    className="w-6 h-3 rounded flex items-center justify-center transition"
                                                                    style={{ background: absenceColor!.bg, color: absenceColor!.fg, border: `1px solid ${absenceColor!.border}` }}
                                                                >
                                                                    <Home size={9} strokeWidth={2} />
                                                                </button>
                                                            ) : (
                                                                <div className="relative w-6 h-3 flex items-center justify-center">
                                                                    <div className="w-6 h-1.5 rounded-full bg-default/40 overflow-hidden absolute">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all ${capacityBarColor(v, cap)}`}
                                                                            style={{ width: `${Math.min(100, (v / Math.max(cap > 0 ? cap : v, 1)) * 100)}%` }}
                                                                        />
                                                                    </div>
                                                                    {canToggleHO && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleHomeofficeFor(i, null)}
                                                                            title="Homeoffice eintragen"
                                                                            className="absolute opacity-0 group-hover:opacity-100 transition w-4 h-4 rounded flex items-center justify-center"
                                                                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                                                                        >
                                                                            <Home size={8} strokeWidth={2.25} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span
                                                                className={`text-[9px] tabular-nums leading-none ${absenceType && absenceType !== 'home_office' ? 'text-text-placeholder opacity-50' : capacityTextColor(v, cap)}`}
                                                            >
                                                                {v > 0 ? `${v}` : <span className="text-text-placeholder opacity-40">·</span>}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                <div className="ml-1 px-2.5 py-1 bg-surface rounded-lg border border-default shadow-sm" title={empOver ? 'Mehr Stunden eingetragen als Soll-Kapazität' : undefined}>
                                                    <span className={`text-[11px] font-bold ${empTotal === 0 ? 'text-text-placeholder' : empOver ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        {empTotal > 0 ? `${empTotal}h` : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {/* ── Allocation rows ── */}
                                {row.allocations.map(alloc => {
                                    const sc = getStatusConfig(alloc.allocation_status);
                                    const rowTotal = DAYS.reduce((s, d) => s + ((alloc as any)[d] || 0), 0);

                                    return (
                                        <tr key={alloc.id} className="border-b border-default hover:bg-hover/40 group transition-colors" style={{ minHeight: 36 }}>
                                            {/* Status left border */}
                                            <td className={`border-r border-default border-l-[3px] ${sc.border} w-1 p-0`}></td>

                                            {/* Projekt (2-line) */}
                                            <td className="px-3 border-r border-default py-1.5 max-w-0 w-64">
                                                <div className="font-semibold text-[11px] text-text-primary truncate leading-tight">
                                                    {alloc.projects?.title || '—'}
                                                </div>
                                                {(alloc.projects?.clients?.name || alloc.projects?.job_number) && (
                                                    <div className="text-[9px] text-text-muted leading-tight mt-0.5 truncate">
                                                        {alloc.projects?.clients?.name && (
                                                            <span>{alloc.projects.clients.name}</span>
                                                        )}
                                                        {alloc.projects?.clients?.name && alloc.projects?.job_number && (
                                                            <span className="opacity-40 mx-1">·</span>
                                                        )}
                                                        {alloc.projects?.job_number && (
                                                            <span className="font-mono opacity-70">{alloc.projects.job_number}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Aufgabe */}
                                            <td className="border-r border-default p-0 w-44">
                                                <DebouncedInput
                                                    id={`${alloc.id}-task`}
                                                    isTextarea
                                                    className="appearance-none w-full h-full min-h-[36px] px-2 bg-transparent focus:bg-subtle focus:outline-none text-text-primary text-[11px] placeholder:text-text-placeholder block"
                                                    initialValue={alloc.task_description || ''}
                                                    onSave={val => onUpdateAllocation(alloc.id, 'task_description', val)}
                                                    placeholder="Aufgabe..."
                                                />
                                            </td>

                                            {/* Status badge */}
                                            <td className="px-1.5 border-r border-default">
                                                <select
                                                    className={`appearance-none w-full px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer focus:outline-none text-center truncate ${sc.badge}`}
                                                    value={alloc.allocation_status || 'Geplant'}
                                                    onChange={e => onUpdateAllocation(alloc.id, 'allocation_status', e.target.value)}
                                                >
                                                    {ALLOCATION_STATUS_OPTIONS.map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Hour cells Mo–Fr — bei Abwesenheit subtil eingefärbt */}
                                            {DAYS.map((day, dayIdx) => {
                                                const dayAbsence = absenceMap[dayIdx];
                                                const tintStyle: React.CSSProperties = dayAbsence
                                                    ? { background: ABSENCE_TYPE_COLOR[dayAbsence.type].bg }
                                                    : {};
                                                return (
                                                    <td
                                                        key={day}
                                                        className="border-r border-default p-0 w-12 h-9"
                                                        style={tintStyle}
                                                        title={dayAbsence ? ABSENCE_TYPE_LABEL[dayAbsence.type] : undefined}
                                                    >
                                                        <HourCell
                                                            allocId={alloc.id}
                                                            day={day}
                                                            value={(alloc as any)[day] || 0}
                                                            onSave={v => onUpdateAllocation(alloc.id, day, v)}
                                                        />
                                                    </td>
                                                );
                                            })}

                                            {/* Row total Σ */}
                                            <td className="border-r border-default text-center w-10 px-0">
                                                <span className={`text-[11px] tabular-nums ${rowTotal > 0 ? 'font-bold text-text-primary' : 'text-text-placeholder opacity-40'}`}>
                                                    {rowTotal > 0 ? rowTotal : '—'}
                                                </span>
                                            </td>

                                            {/* Anmerkung */}
                                            <td className="border-r border-default p-0 w-36">
                                                <DebouncedInput
                                                    id={`${alloc.id}-comment`}
                                                    isTextarea
                                                    className="appearance-none w-full h-full min-h-[36px] px-2 bg-transparent focus:bg-subtle focus:outline-none text-[10px] text-text-muted placeholder:text-text-placeholder block"
                                                    initialValue={alloc.comment || ''}
                                                    onSave={val => onUpdateAllocation(alloc.id, 'comment', val)}
                                                    placeholder="Anmerkung..."
                                                />
                                            </td>

                                            {/* Delete */}
                                            <td className="text-center w-8">
                                                <button
                                                    onClick={() => onDeleteAllocation(alloc.id)}
                                                    className="p-1 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* ── Add row ── */}
                                <AddRow
                                    employeeId={row.employee.id}
                                    projects={projects}
                                    allClients={allClients}
                                    onCreate={onCreateAllocation}
                                />
                            </React.Fragment>
                        );
                    })}

                    {/* ── Global footer ── */}
                    <tr className="sticky bottom-0 z-10 bg-text-primary text-surface font-bold border-t-2 border-default">
                        <td className="w-1 p-0"></td>
                        <td colSpan={3} className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.2em] font-black opacity-80">
                            Gesamt {globalTotal > 0 ? `· ${globalTotal}h` : ''}
                        </td>
                        {globalDayValues.map((v, i) => {
                            const over = v > globalCaps[i];
                            return (
                                <td key={i} className="text-center py-3 border-l border-surface/15 text-sm tabular-nums"
                                    title={over ? `Über Team-Soll (${globalCaps[i]}h)` : undefined}>
                                    {v > 0
                                        ? <span className={over ? 'text-red-400 font-black' : ''}>{v}</span>
                                        : <span className="opacity-30">—</span>}
                                </td>
                            );
                        })}
                        <td className="text-center py-3 border-l border-surface/15 text-sm tabular-nums font-black"
                            title={(globalAnyOver || globalTotal > globalWeekCap) ? `Über Team-Soll (${globalWeekCap}h)` : undefined}>
                            {globalTotal > 0
                                ? <span className={(globalAnyOver || globalTotal > globalWeekCap) ? 'text-red-400' : ''}>{globalTotal}</span>
                                : <span className="opacity-30">—</span>}
                        </td>
                        <td colSpan={2} className="border-l border-surface/15"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

// ─── AddRow ─────────────────────────────────────────────────────────────────────
function AddRow({ employeeId, projects, allClients, onCreate }: {
    employeeId: string;
    projects: Project[];
    allClients: Client[];
    onCreate: (uid: string, data: any) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const selRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Vorschlagsliste per Portal an document.body — sonst schneidet der
    // overflow-Container der Tabelle die Liste ab.
    const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(null);
    const updateRect = () => {
        const el = inputRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const width = 384;
        const left = Math.max(12, Math.min(r.left - 24, window.innerWidth - width - 12));
        setMenuRect({ left, top: r.bottom + 4, width });
    };

    useEffect(() => {
        if (!open) return;
        updateRect();
        const handler = () => updateRect();
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const filtered = useMemo(() => {
        if (query.length < 1) return [];
        const q = query.toLowerCase();
        return projects
            .filter(p => p.job_number && (
                p.title.toLowerCase().includes(q) ||
                p.job_number.toLowerCase().includes(q) ||
                p.clients?.name?.toLowerCase().includes(q)
            ))
            .slice(0, 7);
    }, [query, projects]);

    const select = (proj: Project) => {
        selRef.current = true;
        onCreate(employeeId, { type: 'existing', projectId: proj.id });
        setQuery('');
        setOpen(false);
        // stay expanded for bulk-add — refocus input
        setTimeout(() => { selRef.current = false; inputRef.current?.focus(); }, 200);
    };

    const handleBlur = () => {
        setTimeout(() => {
            setOpen(false);
            if (selRef.current) return;
            if (!query.trim()) { setExpanded(false); return; }

            const exact = projects.find(p => p.job_number && p.title.toLowerCase() === query.trim().toLowerCase());
            if (exact) {
                onCreate(employeeId, { type: 'existing', projectId: exact.id });
                setQuery('');
                // stay expanded
            } else {
                setShowModal(true);
            }
        }, 250);
    };

    const cancel = () => { setExpanded(false); setQuery(''); setOpen(false); };

    if (!expanded) {
        return (
            <tr className="border-b border-default">
                <td colSpan={COL_COUNT} className="py-0.5">
                    <button
                        className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-text-placeholder hover:text-accent hover:bg-accent-subtle/10 transition-colors text-left"
                        onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                    >
                        <Plus size={11} className="shrink-0" />
                        Eintrag hinzufügen
                    </button>
                </td>
            </tr>
        );
    }

    return (
        <>
            <tr className="border-b border-default bg-accent-subtle/5 border-l-[3px] border-l-accent/30">
                {/* status-border placeholder */}
                <td className="w-1 border-r border-default p-0"></td>

                {/* Search field spanning Projekt + Aufgabe + Status */}
                <td colSpan={3} className="border-r border-default px-0 h-10 p-0 relative">
                    <div className="flex items-center gap-2 px-3 h-full">
                        <Search size={11} className="text-accent shrink-0" />
                        <input
                            ref={inputRef}
                            className="flex-1 bg-transparent focus:outline-none text-[11px] text-text-primary placeholder:text-text-placeholder font-medium"
                            placeholder="Projekt suchen oder neu anlegen..."
                            value={query}
                            onChange={e => { setQuery(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            onBlur={handleBlur}
                            onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
                        />
                    </div>

                    {open && query.length >= 1 && menuRect && createPortal(
                        <div
                            className="fixed bg-surface shadow-xl border border-default rounded-xl z-[120] overflow-hidden"
                            style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width }}
                        >
                            {filtered.map(proj => (
                                <button
                                    key={proj.id}
                                    className="w-full text-left px-3 py-2 hover:bg-hover border-b border-default last:border-none flex flex-col gap-0.5"
                                    onMouseDown={() => select(proj)}
                                >
                                    <span className="text-[11px] font-semibold text-text-primary truncate">{proj.title}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-text-muted">{proj.job_number}</span>
                                        {proj.clients?.name && <span className="text-[9px] text-text-muted">{proj.clients.name}</span>}
                                    </div>
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <div className="px-3 py-2.5 text-[10px] text-text-muted italic flex items-center gap-1.5">
                                    <Plus size={10} className="opacity-60" />
                                    Neu anlegen: „{query}"
                                </div>
                            )}
                        </div>,
                        document.body,
                    )}
                </td>

                {/* Empty day cells */}
                {DAYS.map(d => <td key={d} className="border-r border-default bg-subtle/20 w-12"></td>)}
                <td className="border-r border-default bg-subtle/20 w-10"></td>

                {/* Cancel */}
                <td className="border-r border-default px-2">
                    <button
                        className="text-text-muted hover:text-text-secondary text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                        onClick={cancel}
                    >
                        <X size={10} /> Abbrechen
                    </button>
                </td>
                <td className="w-8"></td>
            </tr>

            {showModal && (
                <tr>
                    <td colSpan={COL_COUNT} className="p-0 border-none">
                        <NewProjectModal
                            projectTitle={query}
                            allClients={allClients}
                            onSave={clientName => {
                                setShowModal(false);
                                onCreate(employeeId, { type: 'new', clientName, projectTitle: query });
                                setQuery('');
                                setTimeout(() => inputRef.current?.focus(), 300);
                            }}
                            onCancel={() => { setShowModal(false); cancel(); }}
                        />
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── New Project Modal ──────────────────────────────────────────────────────────
function NewProjectModal({ projectTitle, allClients, onSave, onCancel }: {
    projectTitle: string;
    allClients: Client[];
    onSave: (clientName: string) => void;
    onCancel: () => void;
}) {
    const [localClient, setLocalClient] = useState('');
    const [clientOpen, setClientOpen] = useState(false);

    const filtered = useMemo(() => {
        if (!localClient) return [];
        return allClients.filter(c => c.name.toLowerCase().includes(localClient.toLowerCase())).slice(0, 5);
    }, [localClient, allClients]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl shadow-2xl border border-default p-8 w-full max-w-sm m-4 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-1 text-text-primary">Neues Projekt anlegen</h3>
                <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                    Die Jobnummer wird automatisch vergeben.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Projekttitel</label>
                        <div className="w-full border border-default rounded-xl px-4 py-2.5 text-sm text-text-secondary bg-subtle font-medium">
                            {projectTitle}
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Kunde</label>
                        <input
                            autoFocus
                            className="appearance-none w-full border border-default rounded-xl px-4 py-2.5 text-sm text-text-primary bg-subtle focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
                            placeholder="Kunden suchen oder neu..."
                            value={localClient}
                            onChange={e => { setLocalClient(e.target.value); setClientOpen(true); }}
                            onFocus={() => setClientOpen(true)}
                        />
                        {clientOpen && filtered.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-surface shadow-xl border border-default rounded-xl mt-1 z-50 overflow-hidden">
                                {filtered.map(c => (
                                    <button
                                        key={c.id}
                                        className="w-full text-left px-4 py-2 hover:bg-hover border-b border-default last:border-none text-sm text-text-primary font-medium"
                                        onClick={() => { setLocalClient(c.name); setClientOpen(false); }}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onCancel} className="px-5 py-2.5 text-sm font-bold text-text-secondary hover:bg-hover rounded-xl transition-colors">
                        Abbrechen
                    </button>
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
