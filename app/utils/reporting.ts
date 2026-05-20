import { TimeEntry, Employee, Project } from '../types';

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
    weeklyTarget: number,
    projects: Project[] = [],
): PeriodStats {
    const inRange = entries.filter(e => {
        const d = new Date(e.date);
        return d >= from && d <= to;
    });

    const totalHours = inRange.reduce((s, e) => s + Number(e.hours || 0), 0);

    // Soll: weeklyTarget skaliert auf die Zeitspanne (Werktage Mo–Fr)
    const businessDays = countBusinessDays(from, to);
    const dailyTarget = weeklyTarget / 5;
    const targetHours = businessDays * dailyTarget;

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
