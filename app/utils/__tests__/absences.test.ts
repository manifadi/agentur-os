import { describe, it, expect } from 'vitest';
import { absenceWorkingDays, absenceWorkingHours, avgWorkdayHours, computeVacationBalance } from '../absences';
import type { Absence, Employee } from '../../types';

// Wochenplan Mo–Do 8h, Fr 6h (38h-Woche)
const SCHED = [8, 8, 8, 8, 6, 0, 0];

// 2026-06-15 (Mo) – 2026-06-19 (Fr): keine bundesweiten DE-Feiertage in dieser Woche.
describe('absenceWorkingDays', () => {
    it('zählt eine volle Arbeitswoche (Mo–Fr) als 5 Tage', () => {
        expect(absenceWorkingDays({ start_date: '2026-06-15', end_date: '2026-06-19', half_day: 'none' }, 'DE')).toBe(5);
    });

    it('ignoriert Wochenenden', () => {
        expect(absenceWorkingDays({ start_date: '2026-06-20', end_date: '2026-06-21', half_day: 'none' }, 'DE')).toBe(0);
    });

    it('rechnet einen halben Tag an einem Arbeitstag als 0.5', () => {
        expect(absenceWorkingDays({ start_date: '2026-06-15', end_date: '2026-06-15', half_day: 'start' }, 'DE')).toBe(0.5);
    });
});

describe('absenceWorkingHours', () => {
    it('summiert die geplanten Tagesstunden einer Woche (Mo–Do 8h, Fr 6h = 38h)', () => {
        expect(absenceWorkingHours({ start_date: '2026-06-15', end_date: '2026-06-19', half_day: 'none' }, SCHED, 'DE')).toBe(38);
    });

    it('verbraucht am Freitag nur die geplanten 6h', () => {
        expect(absenceWorkingHours({ start_date: '2026-06-19', end_date: '2026-06-19', half_day: 'none' }, SCHED, 'DE')).toBe(6);
    });

    it('halber Tag = 0,5 × Tagessoll (Montag 8h → 4h)', () => {
        expect(absenceWorkingHours({ start_date: '2026-06-15', end_date: '2026-06-15', half_day: 'start' }, SCHED, 'DE')).toBe(4);
    });

    it('exakte Uhrzeit zählt die Differenz, gedeckelt auf das Tagessoll', () => {
        expect(absenceWorkingHours({ start_date: '2026-06-15', end_date: '2026-06-15', half_day: 'none', start_time: '08:00', end_time: '12:00' }, SCHED, 'DE')).toBe(4);
    });

    it('Wochenende ergibt 0 Stunden', () => {
        expect(absenceWorkingHours({ start_date: '2026-06-20', end_date: '2026-06-21', half_day: 'none' }, SCHED, 'DE')).toBe(0);
    });
});

describe('computeVacationBalance', () => {
    const emp = {
        id: 'e1', name: 'Test', initials: 'T',
        weekly_schedule: SCHED, weekly_hours: 38,
        vacation_weeks_per_year: 5,
    } as Employee;

    it('Jahresanspruch = Wochen × Wochenstunden (5 × 38 = 190h)', () => {
        const b = computeVacationBalance(emp, [], 2026, 'DE');
        expect(b.entitlementHours).toBe(190);
        expect(b.avgDayHours).toBe(avgWorkdayHours(SCHED)); // 38/5 = 7.6
    });

    it('zieht genehmigten Urlaub in Stunden ab', () => {
        const abs: Absence[] = [{
            id: 'a1', organization_id: 'o', employee_id: 'e1', type: 'vacation',
            start_date: '2026-06-15', end_date: '2026-06-19', half_day: 'none',
            status: 'approved', requested_at: '2026-06-01',
        } as Absence];
        const b = computeVacationBalance(emp, abs, 2026, 'DE');
        expect(b.usedHours).toBe(38);
        expect(b.remainingHours).toBe(152);
    });

    it('Override überschreibt den automatischen Anspruch', () => {
        const b = computeVacationBalance({ ...emp, vacation_hours_override: 213.5 } as Employee, [], 2026, 'DE');
        expect(b.entitlementHours).toBe(213.5);
    });

    it('Staffelung: 6 Wochen ab 25 Dienstjahren', () => {
        const b = computeVacationBalance({ ...emp, started_at: '1995-01-01' } as Employee, [], 2026, 'DE');
        expect(b.weeks).toBe(6);
        expect(b.seniorityApplied).toBe(true);
        expect(b.entitlementHours).toBe(228); // 6 × 38
    });
});
