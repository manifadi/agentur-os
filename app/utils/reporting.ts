import { TimeEntry, Employee, Project, AttendanceEntry } from '../types';

// ── Date helpers ──────────────────────────────────────────────────

export function startOfWeek(d: Date): Date {
    const out = new Date(d);
    const day = out.getDay();
    out.setDate(out.getDate() - ((day + 6) % 7)); // Mo
    out.setHours(0, 0, 0, 0);
    return out;
}

export function endOfWeek(d: Date): Date {
    const start = startOfWeek(d);
    const out = new Date(start);
    out.setDate(out.getDate() + 6);
    out.setHours(23, 59, 59, 999);
    return out;
}

export function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatRangeLabel(from: Date, to: Date): string {
    const f = (d: Date) => d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
    return `${f(from)} – ${f(to)}`;
}

// ── Aggregation ───────────────────────────────────────────────────

export interface ProjectBreakdown {
    projectId: string;
    projectTitle: string;
    clientName?: string;
    hours: number;
    pct: number;
}

export interface DayBreakdown {
    date: string;          // ISO YYYY-MM-DD
    hours: number;
    entries: TimeEntry[];
}

export interface PeriodStats {
    totalHours: number;
    targetHours: number;
    deltaHours: number;     // ist − soll
    deltaPct: number;       // ist/soll − 1, gerundet
    projects: ProjectBreakdown[];
    days: DayBreakdown[];
}

export function aggregatePeriod(
    entries: TimeEntry[],
    from: Date,
    to: Date,
    /** Soll-Stunden pro Wochentag: [Mo,Di,Mi,Do,Fr,Sa,So]. Wenn nur eine Zahl: gleichmäßig auf Mo-Fr verteilt. */
    weeklyScheduleOrTarget: number[] | number,
    projects: Project[] = [],
): PeriodStats {
    const inRange = entries.filter(e => {
        const d = new Date(e.date);
        return d >= from && d <= to;
    });

    const totalHours = inRange.reduce((s, e) => s + Number(e.hours || 0), 0);

    // Schedule normalisieren: [Mo..So]
    const schedule = Array.isArray(weeklyScheduleOrTarget)
        ? weeklyScheduleOrTarget
        : [weeklyScheduleOrTarget / 5, weeklyScheduleOrTarget / 5, weeklyScheduleOrTarget / 5, weeklyScheduleOrTarget / 5, weeklyScheduleOrTarget / 5, 0, 0];

    // Soll: summiere die Tages-Soll-Werte über alle Tage im Zeitraum
    let targetHours = 0;
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
        const dayIdx = (cur.getDay() + 6) % 7; // 0=Mo
        targetHours += schedule[dayIdx] ?? 0;
        cur.setDate(cur.getDate() + 1);
    }

    // Projekt-Verteilung
    const projMap = new Map<string, { hours: number; title: string; client?: string }>();
    for (const e of inRange) {
        const id = e.project_id;
        const existing = projMap.get(id);
        if (existing) {
            existing.hours += Number(e.hours || 0);
        } else {
            const proj = e.projects || projects.find(p => p.id === id);
            projMap.set(id, {
                hours: Number(e.hours || 0),
                title: proj?.title || '(unbekanntes Projekt)',
                client: (proj as any)?.clients?.name,
            });
        }
    }
    const projectBreakdown: ProjectBreakdown[] = Array.from(projMap.entries())
        .map(([projectId, v]) => ({
            projectId,
            projectTitle: v.title,
            clientName: v.client,
            hours: v.hours,
            pct: totalHours > 0 ? v.hours / totalHours : 0,
        }))
        .sort((a, b) => b.hours - a.hours);

    // Tages-Verteilung
    const dayMap = new Map<string, DayBreakdown>();
    const cursor = new Date(from);
    while (cursor <= to) {
        const key = isoDate(cursor);
        dayMap.set(key, { date: key, hours: 0, entries: [] });
        cursor.setDate(cursor.getDate() + 1);
    }
    for (const e of inRange) {
        const key = e.date.slice(0, 10);
        const bucket = dayMap.get(key);
        if (bucket) {
            bucket.hours += Number(e.hours || 0);
            bucket.entries.push(e);
        }
    }
    const days = Array.from(dayMap.values());

    return {
        totalHours,
        targetHours,
        deltaHours: totalHours - targetHours,
        deltaPct: targetHours > 0 ? (totalHours / targetHours) - 1 : 0,
        projects: projectBreakdown,
        days,
    };
}

// ── Anwesenheitszeit (Stempeluhr) ─────────────────────────────────

/** Dauer einer Stempel-Session in Stunden. Offene Session bis `now`. */
export function attendanceHours(entry: AttendanceEntry, now: Date = new Date()): number {
    const start = new Date(entry.clock_in).getTime();
    const end = entry.clock_out ? new Date(entry.clock_out).getTime() : now.getTime();
    const ms = Math.max(0, end - start);
    return ms / 3_600_000;
}

export interface AttendanceDay {
    date: string;            // ISO YYYY-MM-DD (nach clock_in)
    hours: number;
    sessions: AttendanceEntry[];
}

export interface AttendanceStats {
    totalHours: number;
    days: AttendanceDay[];
    sessions: AttendanceEntry[]; // alle im Zeitraum, chronologisch
}

/** Aggregiert Stempel-Sessions deren clock_in im Zeitraum [from,to] liegt. */
export function aggregateAttendance(
    entries: AttendanceEntry[],
    from: Date,
    to: Date,
    now: Date = new Date(),
): AttendanceStats {
    const inRange = entries
        .filter(e => {
            const d = new Date(e.clock_in);
            return d >= from && d <= to;
        })
        .sort((a, b) => a.clock_in.localeCompare(b.clock_in));

    const dayMap = new Map<string, AttendanceDay>();
    let totalHours = 0;
    for (const e of inRange) {
        const h = attendanceHours(e, now);
        totalHours += h;
        const key = isoDate(new Date(e.clock_in));
        const bucket = dayMap.get(key);
        if (bucket) {
            bucket.hours += h;
            bucket.sessions.push(e);
        } else {
            dayMap.set(key, { date: key, hours: h, sessions: [e] });
        }
    }

    return {
        totalHours,
        days: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        sessions: inRange,
    };
}

export function countBusinessDays(from: Date, to: Date): number {
    let count = 0;
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

// ── CSV-Export ────────────────────────────────────────────────────

export function buildCsv(entries: TimeEntry[], employee: Employee, projects: Project[]): string {
    const rows: string[][] = [];
    rows.push(['Datum', 'Mitarbeiter', 'Projekt', 'Kunde', 'Stunden', 'Beschreibung']);
    const projById = new Map(projects.map(p => [p.id, p]));
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    for (const e of sorted) {
        const proj = e.projects || projById.get(e.project_id);
        rows.push([
            e.date.slice(0, 10),
            employee.name,
            proj?.title || '',
            (proj as any)?.clients?.name || '',
            String(e.hours).replace('.', ','),
            (e.description || '').replace(/\n/g, ' '),
        ]);
    }
    return rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
}

/** CSV für Projektzeit-Einträge mehrerer Mitarbeiter (Projekt-/Kunden-Reporting).
 *  Nutzt die jointen Felder (e.employees, e.projects) — fällt auf Maps zurück. */
export function buildTimeEntriesCsv(
    entries: TimeEntry[],
    employees: Employee[] = [],
    projects: Project[] = [],
): string {
    const rows: string[][] = [];
    rows.push(['Datum', 'Mitarbeiter', 'Projekt', 'Kunde', 'Stunden', 'Beschreibung']);
    const empById = new Map(employees.map(e => [e.id, e]));
    const projById = new Map(projects.map(p => [p.id, p]));
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    for (const e of sorted) {
        const proj = e.projects || projById.get(e.project_id);
        const empName = (e as any).employees?.name || empById.get(e.employee_id)?.name || '';
        rows.push([
            e.date.slice(0, 10),
            empName,
            proj?.title || '',
            (proj as any)?.clients?.name || '',
            String(e.hours).replace('.', ','),
            (e.description || '').replace(/\n/g, ' '),
        ]);
    }
    return rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
}

/** CSV für Anwesenheits-Sessions (Stempeluhr). */
export function buildAttendanceCsv(sessions: AttendanceEntry[], employeeName: string): string {
    const rows: string[][] = [];
    rows.push(['Datum', 'Mitarbeiter', 'Einstempeln', 'Ausstempeln', 'Dauer (h)', 'Notiz']);
    const time = (iso?: string | null) => iso
        ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '';
    const sorted = [...sessions].sort((a, b) => a.clock_in.localeCompare(b.clock_in));
    for (const s of sorted) {
        rows.push([
            isoDate(new Date(s.clock_in)),
            employeeName,
            time(s.clock_in),
            time(s.clock_out),
            attendanceHours(s).toFixed(2).replace('.', ','),
            (s.note || '').replace(/\n/g, ' '),
        ]);
    }
    return rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
}

function csvEscape(v: string): string {
    if (/[";\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
}

export function downloadCsv(csv: string, filename: string) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); // BOM für Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
