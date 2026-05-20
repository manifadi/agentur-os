-- Wochenplan pro Mitarbeiter — Teilzeit, 4-Tage-Woche etc.
-- Array [Mo, Di, Mi, Do, Fr, Sa, So] mit Soll-Stunden pro Tag.
-- Default: Vollzeit 5-Tage-Woche à 8h (40h gesamt).
-- Run in Supabase SQL Editor.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_schedule JSONB NOT NULL DEFAULT '[8, 8, 8, 8, 8, 0, 0]'::jsonb;

COMMENT ON COLUMN employees.weekly_schedule IS 'Soll-Stunden pro Wochentag [Mo,Di,Mi,Do,Fr,Sa,So]. Basis für Reporting.';

-- Bestehende weekly_hours kann auf Summe migriert werden falls vorhanden,
-- bleibt aber für Kompatibilität als Cache erhalten.
UPDATE employees
SET weekly_schedule = jsonb_build_array(
    CASE WHEN weekly_hours > 0 THEN ROUND(weekly_hours::numeric / 5, 2) ELSE 8 END,
    CASE WHEN weekly_hours > 0 THEN ROUND(weekly_hours::numeric / 5, 2) ELSE 8 END,
    CASE WHEN weekly_hours > 0 THEN ROUND(weekly_hours::numeric / 5, 2) ELSE 8 END,
    CASE WHEN weekly_hours > 0 THEN ROUND(weekly_hours::numeric / 5, 2) ELSE 8 END,
    CASE WHEN weekly_hours > 0 THEN ROUND(weekly_hours::numeric / 5, 2) ELSE 8 END,
    0, 0
)
WHERE weekly_schedule = '[8, 8, 8, 8, 8, 0, 0]'::jsonb AND weekly_hours IS NOT NULL AND weekly_hours != 40;
