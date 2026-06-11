-- ─────────────────────────────────────────────────────────────────────────
-- invoice_signer_migration
--
-- Erlaubt es, pro Rechnung einen Unterzeichner / eine Ansprechperson
-- (Mitarbeiter) auszuwählen, der/die im generierten PDF mit Name, E-Mail
-- und Telefon erscheint. Fällt nichts gesetzt ist, nutzt das PDF weiterhin
-- den Projektleiter (project.employees).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_invoices
  ADD COLUMN IF NOT EXISTS signer_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

INSERT INTO public.schema_migrations (name) VALUES ('invoice_signer_migration')
  ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
