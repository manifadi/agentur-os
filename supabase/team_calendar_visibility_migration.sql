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
--
-- WICHTIG (Deadlock-Vermeidung): Die beiden Spalten werden in GETRENNTEN
-- Transaktionen angelegt. Würden beide ALTER TABLE in EINER Transaktion laufen,
-- hält der erste einen Exclusive-Lock und der zweite wartet auf die nächste
-- Tabelle — während die laufende App (PostgREST) die Tabellen andersherum
-- liest → Deadlock. lock_timeout lässt es im Konfliktfall schnell abbrechen;
-- dann einfach erneut ausführen (idempotent). Falls möglich, kurz zu einer
-- ruhigen Minute ausführen.
-- ============================================================================

-- ── Schritt 1: external_calendars ───────────────────────────────────────────
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.external_calendars
  ADD COLUMN IF NOT EXISTS shared_with_team BOOLEAN NOT NULL DEFAULT false;
COMMIT;

-- ── Schritt 2: employees ────────────────────────────────────────────────────
-- Vela-Kalender: Default true bewahrt das bisherige Verhalten (öffentliche
-- Vela-Termine sind für Kollegen sichtbar, die einen aktivieren).
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS calendar_shared_with_team BOOLEAN NOT NULL DEFAULT true;
COMMIT;

-- Selbst-Registrierung (Migrations-Tracking, siehe supabase/README.md).
INSERT INTO public.schema_migrations (name) VALUES ('team_calendar_visibility_migration')
  ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
