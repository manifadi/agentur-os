import { describe, it, expect } from 'vitest';
import { computeOverlapLayout } from '../overlapLayout';

const ev = (id: string, start_at: string, end_at: string) => ({ id, start_at, end_at });

describe('computeOverlapLayout', () => {
    it('liefert eine leere Map für eine leere Liste', () => {
        expect(computeOverlapLayout([]).size).toBe(0);
    });

    it('legt nicht-überlappende Events in eine Spalte', () => {
        const m = computeOverlapLayout([
            ev('a', '2026-06-15T09:00:00Z', '2026-06-15T10:00:00Z'),
            ev('b', '2026-06-15T10:00:00Z', '2026-06-15T11:00:00Z'),
        ]);
        expect(m.get('a')).toEqual({ col: 0, totalCols: 1 });
        expect(m.get('b')).toEqual({ col: 0, totalCols: 1 });
    });

    it('verteilt zwei überlappende Events auf zwei Spalten', () => {
        const m = computeOverlapLayout([
            ev('a', '2026-06-15T09:00:00Z', '2026-06-15T10:30:00Z'),
            ev('b', '2026-06-15T10:00:00Z', '2026-06-15T11:00:00Z'),
        ]);
        expect(m.get('a')?.totalCols).toBe(2);
        expect(m.get('b')?.totalCols).toBe(2);
        expect(m.get('a')?.col).not.toBe(m.get('b')?.col);
    });
});
