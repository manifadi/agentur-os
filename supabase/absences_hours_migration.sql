-- ================================================================
-- AGENTUR OS — Urlaub stundenbasiert (österr. Urlaubsrecht, UrlG §2)
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Hintergrund:
--   Der gesetzliche Urlaubsanspruch in Österreich beträgt 5 Wochen/Jahr
--   (6 Wochen ab 25 Dienstjahren). In der Praxis – v.a. bei Teilzeit oder
--   ungleichen Tagesstunden – wird er aliquot in STUNDEN geführt:
--       Anspruch (Std.) = Urlaubs-Wochen × Wochenstunden
--   Ein Urlaubstag verbraucht die für diesen Wochentag geplanten Soll-Stunden
--   (aus employees.weekly_schedule).
--
--   Die Bilanz wird im Frontend berechnet (Feiertage + weekly_schedule liegen
--   dort vor — konsistent mit der bestehenden "Feiertage = Frontend-Job"-Logik).
--   Diese Migration ergänzt nur die nötigen Konfigurationsfelder.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. employees: stundenbasierte Urlaubs-Konfiguration
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS vacation_weeks_per_year  NUMERIC NOT NULL DEFAULT 5,   -- gesetzl. Basis: 5 Wochen
  ADD COLUMN IF NOT EXISTS vacation_hours_override  NUMERIC,                       -- optional fixe Jahresstunden
  ADD COLUMN IF NOT EXISTS vacation_carryover_hours NUMERIC NOT NULL DEFAULT 0;    -- Übertrag in Stunden

-- Plausibilitäts-Checks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_vacation_weeks_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_vacation_weeks_check
      CHECK (vacation_weeks_per_year >= 0 AND vacation_weeks_per_year <= 52);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_vacation_hours_override_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_vacation_hours_override_check
      CHECK (vacation_hours_override IS NULL OR vacation_hours_override >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_vacation_carryover_hours_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_vacation_carryover_hours_check
      CHECK (vacation_carryover_hours >= 0);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- 2. PostgREST Schema-Cache neu laden
-- ────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
