// ─────────────────────────────────────────────────────────────
// Abwesenheits-Helpers — Working-Days, Feiertags-Logik
// Nutzt die date-holidays-Library für DE/AT/CH komplett.
// ─────────────────────────────────────────────────────────────
import Holidays from 'date-holidays';
import { Absence, AbsenceType } from '../types';

let _hd: Holidays | null = null;
let _hdKey: string = '';

function getHolidays(country: string, state?: string | null): Holidays {
    const key = `${country}|${state || ''}`;
    if (_hd && _hdKey === key) return _hd;
    _hd = state ? new Holidays(country, state) : new Holidays(country);
    _hdKey = key;
    return _hd;
}

export function isPublicHoliday(date: Date, country = 'DE', state?: string | null): boolean {
    const h = getHolidays(country, state);
    const result: any = h.isHoliday(date);
    if (!result) return false;
    if (Array.isArray(result)) return result.some((r: any) => r.type === 'public');
    return result.type === 'public';
}

export function isWeekend(date: Date): boolean {
    const d = date.getDay();
    return d === 0 || d === 6;
}

/** Tatsächliche Arbeitstage in einem Bereich (ohne WE + Feiertage). */
export function workingDaysInRange(
    start: Date,
    end: Date,
    country = 'DE',
    state?: string | null,
): number {
    if (start > end) return 0;
    const h = getHolidays(country, state);
    let count = 0;
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const stop = new Date(end);
    stop.setHours(0, 0, 0, 0);
    while (cur <= stop) {
        const wd = cur.getDay();
        if (wd !== 0 && wd !== 6) {
            const r: any = h.isHoliday(cur);
            const isHol = !!r && (Array.isArray(r) ? r.some((x: any) => x.type === 'public') : r.type === 'public');
            if (!isHol) count++;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

/** Bruchteil eines Arbeitstags (8h Referenz) aus einer Uhrzeitspanne "HH:MM". */
export function timeRangeFraction(startTime: string, endTime: string): number {
    const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };
    const diff = toMin(endTime) - toMin(startTime);
    if (!(diff > 0)) return 0;
    return Math.min(1, Math.round((diff / 60 / 8) * 100) / 100);
}

/** Anzahl Tage einer Abwesenheit unter Berücksichtigung von WE + Feiertagen, halben Tagen + exakten Uhrzeiten. */
export function absenceWorkingDays(
    a: Pick<Absence, 'start_date' | 'end_date' | 'half_day'> & { start_time?: string | null; end_time?: string | null },
    country = 'DE',
    state?: string | null,
): number {
    const start = new Date(a.start_date);
    const end   = new Date(a.end_date);
    if (a.start_date === a.end_date) {
        const isWorkday = workingDaysInRange(start, end, country, state) > 0;
        if (!isWorkday) return 0;
        // Exakte Uhrzeit hat Vorrang vor Halbtags-Kennzeichnung
        if (a.start_time && a.end_time) return timeRangeFraction(a.start_time, a.end_time);
        if (a.half_day !== 'none') return 0.5;
    }
    return workingDaysInRange(start, end, country, state);
}

/** Prüft ob ein bestimmter Tag durch eine Abwesenheit abgedeckt ist. */
export function isDateCovered(date: Date, a: Absence): boolean {
    const d = date.toISOString().slice(0, 10);
    return d >= a.start_date && d <= a.end_date;
}

/** Findet alle Abwesenheiten eines Mitarbeiters an einem bestimmten Tag. */
export function absencesOnDate(employeeId: string, date: Date, all: Absence[]): Absence[] {
    return all.filter(a =>
        a.employee_id === employeeId
        && a.status === 'approved'
        && isDateCovered(date, a)
    );
}

/** Höchste Priorität: vacation > unpaid > zeitausgleich > sick > other > home_office. */
export function dominantAbsenceType(absences: Absence[]): AbsenceType | null {
    if (!absences.length) return null;
    const order: AbsenceType[] = ['vacation', 'unpaid_vacation', 'zeitausgleich', 'sick', 'other', 'home_office'];
    for (const t of order) {
        if (absences.some(a => a.type === t)) return t;
    }
    return null;
}

/** Reduziert Soll-Kapazität bei ganztägiger Abwesenheit auf 0, Homeoffice bleibt unverändert. */
export function capacityFactorForAbsence(type: AbsenceType): number {
    return type === 'home_office' ? 1 : 0;
}

/** Formatiert ein Datums-Bereich-Label, z.B. "2.-6. Juni" oder "12. Juni" */
export function formatAbsenceRange(start: string, end: string, half?: string, startTime?: string | null, endTime?: string | null): string {
    const s = new Date(start);
    const e = new Date(end);
    const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
    const timeSuffix = (startTime && endTime) ? ` (${hhmm(startTime)}–${hhmm(endTime)})` : '';
    const halfSuffix = timeSuffix || (half === 'start' ? ' (vorm.)' : half === 'end' ? ' (nachm.)' : '');
    if (start === end) {
        return s.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) + halfSuffix;
    }
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) {
        return `${s.getDate()}.–${e.getDate()}. ${e.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
