import { describe, it, expect } from 'vitest';
import { absenceWorkingDays } from '../absences';

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
