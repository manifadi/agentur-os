-- Weekly hours target per employee (für Soll/Ist-Reporting)
-- Default: 40h/Woche (Vollzeit AT/DE)
-- Run in Supabase SQL Editor.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 40.0;

COMMENT ON COLUMN employees.weekly_hours IS 'Vereinbarte Wochenstunden (Soll) für Reporting. Default 40 = Vollzeit.';
