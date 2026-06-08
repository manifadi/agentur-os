-- ============================================================================
-- UI-SPRACHE PRO NUTZER
-- ============================================================================
-- Speichert die gewählte Oberflächen-Sprache je Mitarbeiter ('de' | 'en'),
-- damit sie dem Login geräteübergreifend folgt. NULL → App nutzt Default/Browser.
-- Idempotent. Im Supabase SQL Editor ausführen.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS locale TEXT;
COMMIT;

INSERT INTO public.schema_migrations (name) VALUES ('employees_locale_migration')
  ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
