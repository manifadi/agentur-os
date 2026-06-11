-- ================================================================
-- AGENTUR OS — Anrede (Geschlecht) für Kontakte
-- Ermöglicht Grußformel-Vorschläge + Platzhalter in Angebots-/
-- Rechnungstexten ([anrede], [vorname], [nachname] …).
-- Im Supabase SQL Editor ausführen (idempotent).
-- ================================================================

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS salutation TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_contacts_salutation_check') THEN
    ALTER TABLE public.client_contacts
      ADD CONSTRAINT client_contacts_salutation_check
      CHECK (salutation IS NULL OR salutation IN ('herr', 'frau'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
