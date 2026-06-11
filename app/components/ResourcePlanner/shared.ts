import { Employee } from '../../types';

// ─── Allocation-Status — Single Source of Truth für Karten- UND Tabellen-Ansicht ──
// Beide Ansichten nutzen exakt dieselben Optionen, Labels und Farben.
export const ALLOCATION_STATUS_OPTIONS = [
    'Prio/Asap',
    'Bearbeitung möglich',
    'Geplant',
    'Warten auf Kundenfeedback',
    'Erledigt',
] as const;

export type AllocStatus = typeof ALLOCATION_STATUS_OPTIONS[number];

export const STATUS_CONFIG: Record<AllocStatus, { border: string; badge: string; label: string }> = {
    'Prio/Asap':                 { border: 'border-l-red-500',     badge: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',                 label: 'Prio/Asap' },
    'Bearbeitung möglich':       { border: 'border-l-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', label: 'Bearbeitung möglich' },
    'Geplant':                   { border: 'border-l-slate-300',   badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',           label: 'Geplant' },
    'Warten auf Kundenfeedback': { border: 'border-l-amber-400',   badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',         label: 'Warten auf Kundenfeedback' },
    'Erledigt':                  { border: 'border-l-blue-400',    badge: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',             label: 'Erledigt' },
};

export function getStatusConfig(s?: string) {
    return STATUS_CONFIG[(s as AllocStatus)] ?? STATUS_CONFIG['Geplant'];
}

// ─── Kapazität ────────────────────────────────────────────────────────────────
// Soll-Stunden eines Mitarbeiters für einen Wochentag-Index (0 = Mo … 4 = Fr).
// Quelle: employees.weekly_schedule [Mo,Di,Mi,Do,Fr,Sa,So] (vom Admin gepflegt).
// Fallback 8h, wenn kein Wochenplan hinterlegt ist.
export function dayCapacity(employee: Employee, dayIdx: number): number {
    const sched = employee.weekly_schedule;
    if (Array.isArray(sched) && sched.length > dayIdx && typeof sched[dayIdx] === 'number') {
        return sched[dayIdx];
    }
    return 8;
}
