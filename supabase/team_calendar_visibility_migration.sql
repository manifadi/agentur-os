-- ============================================================================
-- TEAM-KALENDER-SICHTBARKEIT
-- ============================================================================
-- Erlaubt es jedem Mitarbeiter, pro Kalender festzulegen, ob dessen Termine
-- für Kollegen sichtbar sind (wenn ein Kollege "meine Termine" aktiviert).
-- Idempotent. Im Supabase SQL Editor ausführen.
--
--   external_calendars.shared_with_team      → externe Kalender (Google/Outlook/CalDAV/iCal)
--   employees.calendar_shared_with_team      → der interne Vela-Kalender des Mitarbeiters
--
-- Hinweis: Privat markierte Einzeltermine bleiben für Kollegen IMMER verborgen
-- (visibility='private' bzw. provider-seitig privat) — die Freigabe gilt nur für
-- nicht-private Termine.
-- ============================================================================

ALTER TABLE public.external_calendars
  ADD COLUMN IF NOT EXISTS shared_with_team BOOLEAN NOT NULL DEFAULT false;

-- Vela-Kalender: Default true bewahrt das bisherige Verhalten (öffentliche
-- Vela-Termine sind für Kollegen sichtbar, die einen aktivieren).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS calendar_shared_with_team BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
