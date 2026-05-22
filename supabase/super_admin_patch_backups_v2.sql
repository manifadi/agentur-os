-- ================================================================
-- AGENTUR OS — Super Admin: Backup-Storage in DB
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Bisher: Backups als JSON-Datei beim Browser heruntergeladen.
-- Jetzt:  Backups in DB-Tabelle gespeichert, automatisch beim Delete.
--
-- Vorteile:
--   - Keine manuelle Datei-Verwaltung
--   - Liste aller Backups in /admin/backups
--   - Auto-Backup beim Löschen (kein Vergessen mehr möglich)
--   - Restore per Klick aus der Liste
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. Tabelle agency_backups
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_backups (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID NOT NULL,
  org_name          TEXT NOT NULL,
  org_plan          TEXT,
  reason            TEXT NOT NULL DEFAULT 'manual',
  backup            JSONB NOT NULL,
  size_bytes        BIGINT NOT NULL,
  employee_count    INTEGER NOT NULL DEFAULT 0,
  project_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id),
  created_by_email  TEXT
);

CREATE INDEX IF NOT EXISTS idx_agency_backups_org_id
  ON public.agency_backups (org_id);
CREATE INDEX IF NOT EXISTS idx_agency_backups_created_at
  ON public.agency_backups (created_at DESC);

ALTER TABLE public.agency_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_backups_super_admin_only" ON public.agency_backups;
CREATE POLICY "agency_backups_super_admin_only" ON public.agency_backups
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 2. RPC: Backup speichern (DB) — standalone
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.save_agency_backup(UUID, TEXT);

CREATE FUNCTION public.save_agency_backup(
  p_org_id UUID,
  p_reason TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup    JSONB;
  v_org_name  TEXT;
  v_org_plan  TEXT;
  v_emp_count INTEGER;
  v_prj_count INTEGER;
  v_backup_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  v_backup := public.export_organization_backup(p_org_id);

  SELECT name, plan INTO v_org_name, v_org_plan
  FROM public.organizations WHERE id = p_org_id;

  v_emp_count := jsonb_array_length(COALESCE(v_backup->'employees', '[]'::jsonb));
  v_prj_count := jsonb_array_length(COALESCE(v_backup->'projects',  '[]'::jsonb));

  INSERT INTO public.agency_backups (
    org_id, org_name, org_plan, reason, backup, size_bytes,
    employee_count, project_count, created_by, created_by_email
  ) VALUES (
    p_org_id, v_org_name, v_org_plan, COALESCE(p_reason, 'manual'),
    v_backup, octet_length(v_backup::text),
    v_emp_count, v_prj_count, auth.uid(), auth.email()
  )
  RETURNING id INTO v_backup_id;

  PERFORM log_super_admin_action(
    'backup.save',
    'agency_backup', v_backup_id::TEXT,
    jsonb_build_object('org_id', p_org_id, 'reason', p_reason, 'size_bytes', octet_length(v_backup::text))
  );

  RETURN v_backup_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.save_agency_backup(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_agency_backup(UUID, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 3. RPC: Liste der Backups (ohne JSONB-Payload — zu groß)
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.list_agency_backups_super_admin();

CREATE FUNCTION public.list_agency_backups_super_admin()
RETURNS TABLE(
  id                UUID,
  org_id            UUID,
  org_name          TEXT,
  org_plan          TEXT,
  reason            TEXT,
  size_bytes        BIGINT,
  employee_count    INTEGER,
  project_count     INTEGER,
  created_at        TIMESTAMPTZ,
  created_by_email  TEXT,
  org_still_exists  BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  RETURN QUERY
  SELECT
    b.id, b.org_id, b.org_name, b.org_plan, b.reason,
    b.size_bytes, b.employee_count, b.project_count,
    b.created_at, b.created_by_email,
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = b.org_id)
  FROM public.agency_backups b
  ORDER BY b.created_at DESC;
END;
$$;

REVOKE ALL  ON FUNCTION public.list_agency_backups_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_agency_backups_super_admin() TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 4. RPC: Backup als JSONB liefern (für Download / Inspection)
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_agency_backup_super_admin(UUID);

CREATE FUNCTION public.get_agency_backup_super_admin(p_backup_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT backup INTO v_backup
  FROM public.agency_backups WHERE id = p_backup_id;

  IF v_backup IS NULL THEN
    RAISE EXCEPTION 'Backup nicht gefunden.';
  END IF;

  RETURN v_backup;
END;
$$;

REVOKE ALL  ON FUNCTION public.get_agency_backup_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agency_backup_super_admin(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 5. RPC: Restore aus DB-Backup (Wrapper um restore_organization_from_backup)
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.restore_agency_backup_from_db(UUID);

CREATE FUNCTION public.restore_agency_backup_from_db(p_backup_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup JSONB;
  v_result JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT backup INTO v_backup
  FROM public.agency_backups WHERE id = p_backup_id;

  IF v_backup IS NULL THEN
    RAISE EXCEPTION 'Backup nicht gefunden.';
  END IF;

  v_result := public.restore_organization_from_backup(v_backup);

  PERFORM log_super_admin_action(
    'backup.restore',
    'agency_backup', p_backup_id::TEXT,
    jsonb_build_object('result', v_result)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL  ON FUNCTION public.restore_agency_backup_from_db(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_agency_backup_from_db(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 6. RPC: Backup löschen
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.delete_agency_backup_super_admin(UUID);

CREATE FUNCTION public.delete_agency_backup_super_admin(p_backup_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name TEXT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT org_name INTO v_org_name
  FROM public.agency_backups WHERE id = p_backup_id;

  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Backup nicht gefunden.';
  END IF;

  DELETE FROM public.agency_backups WHERE id = p_backup_id;

  PERFORM log_super_admin_action(
    'backup.delete',
    'agency_backup', p_backup_id::TEXT,
    jsonb_build_object('org_name', v_org_name)
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.delete_agency_backup_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_agency_backup_super_admin(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 7. delete_organization_super_admin überschreiben:
--    erstellt jetzt automatisch ein Backup BEVOR sie löscht
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.delete_organization_super_admin(UUID);

CREATE FUNCTION public.delete_organization_super_admin(p_org_id UUID)
RETURNS UUID  -- zurückgegeben: backup_id, damit Frontend Link anzeigen kann
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name      TEXT;
  v_backup_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT name INTO v_name FROM public.organizations WHERE id = p_org_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Agentur nicht gefunden.';
  END IF;

  -- Auto-Backup erstellen
  v_backup_id := public.save_agency_backup(p_org_id, 'pre_delete');

  -- Kaskade: alle Tabellen mit organization_id leeren
  DELETE FROM public.employees             WHERE organization_id = p_org_id;
  DELETE FROM public.projects              WHERE organization_id = p_org_id;
  DELETE FROM public.clients               WHERE organization_id = p_org_id;
  DELETE FROM public.organization_features WHERE organization_id = p_org_id;
  DELETE FROM public.agency_settings       WHERE organization_id = p_org_id;
  DELETE FROM public.organizations         WHERE id              = p_org_id;

  PERFORM log_super_admin_action(
    'organization.delete',
    'organization', p_org_id::TEXT,
    jsonb_build_object('name', v_name, 'backup_id', v_backup_id)
  );

  RETURN v_backup_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.delete_organization_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_organization_super_admin(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 8. Realtime-Publication für die neue Tabelle aktivieren
-- ────────────────────────────────────────────────────────────────
-- Damit der SuperAdmin-Context Backups live mitbekommt

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_backups;
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- schon dabei
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.super_admin_audit_log;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.registration_requests;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- Schema-Cache reloaden
-- ────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
