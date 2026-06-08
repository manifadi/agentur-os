-- ============================================================================
-- MIGRATIONS-TRACKING
-- ============================================================================
-- Behebt das "hab ich das schon ausgeführt?"-Problem bei manuellen Migrationen.
-- Eine kleine Tabelle hält fest, welche SQL-Dateien bereits eingespielt wurden.
--
-- Einmalig im Supabase SQL Editor ausführen. Danach: jede NEUE Migration endet
-- mit ihrer Selbst-Registrierung (siehe supabase/README.md), und
--   SELECT name, applied_at FROM public.schema_migrations ORDER BY applied_at;
-- zeigt jederzeit den Stand.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ops-Tabelle: nicht über die API exponieren (RLS an, keine Policy → nur
-- Service-Role / SQL-Editor sehen sie).
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- ── Backfill: bereits eingespielte Migrationen markieren ─────────────────────
-- Annahme: diese Dateien wurden bisher manuell ausgeführt. Falls eine NICHT
-- eingespielt ist, deren Zeile hier entfernen, Datei ausführen und neu tracken.
-- applied_at = jetzt (historische Zeit unbekannt) — markiert nur "ist drin".
INSERT INTO public.schema_migrations (name) VALUES
    ('rls_migration'),
    ('realtime_publication_migration'),
    ('absences_migration'),
    ('add_allocation_status'),
    ('add_external_positions'),
    ('add_missing_project_status_values'),
    ('add_project_links'),
    ('calendar_v2_migration'),
    ('calendar_caldav_migration'),
    ('calendar_account_label_migration'),
    ('calendar_encryption_migration'),
    ('employees_weekly_hours_migration'),
    ('employees_weekly_schedule_migration'),
    ('feedback_migration'),
    ('invite_migration'),
    ('self_registration_migration'),
    ('super_admin_migration'),
    ('super_admin_patch_backup'),
    ('super_admin_patch_backups_v2'),
    ('super_admin_patch_fixes'),
    ('super_admin_patch_fixes_v2'),
    ('super_admin_patch_restore'),
    ('super_admin_patch_rls'),
    ('security_hardening_migration'),
    ('team_calendar_visibility_migration')
ON CONFLICT (name) DO NOTHING;
