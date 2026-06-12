// ─────────────────────────────────────────────────────────────
// Abwesenheits-Helpers — Working-Days, Feiertags-Logik
// Nutzt die date-holidays-Library für DE/AT/CH komplett.
// ─────────────────────────────────────────────────────────────
import Holidays from 'date-holidays';
import { Absence, AbsenceType, Employee, VacationBalance } from '../types';

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

// ─────────────────────────────────────────────────────────────
// Stundenbasierter Urlaub (österr. Recht): Anspruch = Wochen × Wochenstunden;
// ein Urlaubstag verbraucht die im weekly_schedule hinterlegten Soll-Stunden.
// ─────────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE = [8, 8, 8, 8, 8, 0, 0]; // Mo..So

/** Wochenplan eines Mitarbeiters (Mo..So). Fallback: weekly_hours gleichmäßig auf Mo–Fr. */
export function scheduleOf(emp: Pick<Employee, 'weekly_schedule' | 'weekly_hours'>): number[] {
    if (Array.isArray(emp.weekly_schedule) && emp.weekly_schedule.length === 7) return emp.weekly_schedule;
    if (emp.weekly_hours && emp.weekly_hours > 0) {
        const per = emp.weekly_hours / 5;
        return [per, per, per, per, per, 0, 0];
    }
    return DEFAULT_SCHEDULE;
}

/** Stunden zwischen zwei "HH:MM"-Zeiten (>= 0). */
function hoursBetween(startTime: string, endTime: string): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const diff = toMin(endTime) - toMin(startTime);
    return diff > 0 ? diff / 60 : 0;
}

/** Soll-Stunden einer Abwesenheit: pro Arbeitstag (schedule>0, kein Feiertag)
 *  die geplanten Tagesstunden; Halbtag = 0,5×Tag, exakte Zeit = Differenz (gedeckelt). */
export function absenceWorkingHours(
    a: Pick<Absence, 'start_date' | 'end_date' | 'half_day'> & { start_time?: string | null; end_time?: string | null },
    schedule: number[],
    country = 'DE',
    state?: string | null,
): number {
    const start = new Date(a.start_date); start.setHours(0, 0, 0, 0);
    const end = new Date(a.end_date); end.setHours(0, 0, 0, 0);
    if (start > end) return 0;
    const single = a.start_date === a.end_date;
    let total = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const wd = (cur.getDay() + 6) % 7; // Mo=0
        const sched = schedule[wd] ?? 0;
        if (sched > 0 && !isPublicHoliday(cur, country, state)) {
            if (single && a.start_time && a.end_time) total += Math.min(sched, hoursBetween(a.start_time, a.end_time));
            else if (single && a.half_day !== 'none') total += sched * 0.5;
            else total += sched;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return Math.round(total * 100) / 100;
}

/** Durchschnittliche Arbeitstags-Länge (für Tag↔Stunden-Anzeige). */
export function avgWorkdayHours(schedule: number[]): number {
    const workdays = schedule.filter(h => h > 0);
    if (workdays.length === 0) return 0;
    return workdays.reduce((s, h) => s + h, 0) / workdays.length;
}

/** Dienstjahre seit Eintritt (für Aliquotierung + Staffelung). */
export function tenureYears(startedAt?: string | null, ref: Date = new Date()): number {
    if (!startedAt) return 0;
    const start = new Date(startedAt);
    if (isNaN(start.getTime())) return 0;
    return Math.max(0, (ref.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
}

/** Effektive Urlaubswochen: Basis (Default 5), automatisch 6 ab 25 Dienstjahren. */
export function effectiveVacationWeeks(emp: Pick<Employee, 'vacation_weeks_per_year' | 'started_at'>, ref: Date = new Date()): { weeks: number; seniorityApplied: boolean } {
    const base = emp.vacation_weeks_per_year ?? 5;
    const senior = tenureYears(emp.started_at, ref) >= 25;
    const weeks = senior ? Math.max(base, 6) : base;
    return { weeks, seniorityApplied: senior && weeks > base };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Stundenbasierte Urlaubsbilanz für ein Jahr.
 *  `absences` = Abwesenheiten des Mitarbeiters (beliebiger Status); es zählt
 *  nur genehmigter Urlaub, dessen Tage ins Jahr fallen. */
export function computeVacationBalance(
    emp: Employee,
    absences: Absence[],
    year: number,
    country = 'DE',
    state?: string | null,
): VacationBalance {
    const schedule = scheduleOf(emp);
    const weeklyHours = schedule.reduce((s, h) => s + (h || 0), 0);
    const { weeks, seniorityApplied } = effectiveVacationWeeks(emp);

    // Anspruch: Override oder Wochen × Wochenstunden
    let entitlementHours = emp.vacation_hours_override != null ? emp.vacation_hours_override : weeks * weeklyHours;

    // Aliquotierung im Eintrittsjahr (anteilig ab Eintrittsmonat)
    let proRated = false;
    if (emp.started_at) {
        const s = new Date(emp.started_at);
        if (!isNaN(s.getTime()) && s.getFullYear() === year) {
            entitlementHours = entitlementHours * (13 - (s.getMonth() + 1)) / 12;
            proRated = true;
        }
    }
    entitlementHours = round2(entitlementHours);

    const carryoverHours = round2(emp.vacation_carryover_hours ?? 0);
    const totalHours = round2(entitlementHours + carryoverHours);

    // Verbrauch: genehmigter Urlaub, auf das Jahr begrenzt
    const yStart = `${year}-01-01`;
    const yEnd = `${year}-12-31`;
    let usedHours = 0;
    for (const a of absences) {
        if (a.type !== 'vacation' || a.status !== 'approved') continue;
        if (a.end_date < yStart || a.start_date > yEnd) continue;
        const clamped = {
            start_date: a.start_date < yStart ? yStart : a.start_date,
            end_date: a.end_date > yEnd ? yEnd : a.end_date,
            half_day: a.half_day,
            start_time: a.start_time,
            end_time: a.end_time,
        };
        usedHours += absenceWorkingHours(clamped, schedule, country, state);
    }
    usedHours = round2(usedHours);
    const remainingHours = round2(totalHours - usedHours);

    const avgDay = avgWorkdayHours(schedule);
    const toDays = (h: number) => (avgDay > 0 ? round1(h / avgDay) : 0);

    return {
        year,
        entitlementHours, carryoverHours, totalHours, usedHours, remainingHours,
        avgDayHours: round2(avgDay),
        entitlementDays: toDays(entitlementHours),
        carryoverDays: toDays(carryoverHours),
        totalDays: toDays(totalHours),
        usedDays: toDays(usedHours),
        remainingDays: toDays(remainingHours),
        weeks, weeklyHours: round2(weeklyHours), proRated, seniorityApplied,
    };
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
