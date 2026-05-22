-- ================================================================
-- AGENTUR OS — Super Admin: Restore aus Backup-JSON
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Stellt eine gelöschte Agentur aus ihrem Backup-JSON wieder her.
--
-- Design:
--   - Gleiche UUIDs werden wiederverwendet → Foreign-Keys bleiben
--     automatisch konsistent.
--   - employees.user_id wird auf NULL gesetzt — Mitarbeiter müssen
--     sich beim ersten Login neu per Magic-Link verknüpfen.
--     Verhindert UNIQUE-Konflikte falls ein User inzwischen
--     woanders Mitglied wurde.
--   - Trigger werden via session_replication_role temporär
--     deaktiviert (sonst blocken enforce_employee_limit /
--     enforce_org_status den Import).
--   - Existiert die Org noch → Fehler (kein Überschreiben).
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. Peek — JSON anschauen ohne zu importieren (für Frontend)
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.peek_backup_super_admin(JSONB);

CREATE FUNCTION public.peek_backup_super_admin(p_backup JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   UUID;
  v_org_name TEXT;
  v_exists   BOOLEAN;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  IF p_backup IS NULL OR p_backup->'meta' IS NULL THEN
    RAISE EXCEPTION 'Ungültiges Backup: meta fehlt.';
  END IF;

  IF p_backup->'meta'->>'schema_version' <> 'agentur-os/1' THEN
    RAISE EXCEPTION 'Inkompatible Schema-Version: %.', p_backup->'meta'->>'schema_version';
  END IF;

  v_org_id := (p_backup->'organization'->>'id')::UUID;
  v_org_name := p_backup->'organization'->>'name';

  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) INTO v_exists;

  RETURN jsonb_build_object(
    'org_id',         v_org_id,
    'org_name',       v_org_name,
    'org_plan',       p_backup->'organization'->>'plan',
    'exported_at',    p_backup->'meta'->>'exported_at',
    'exported_by',    p_backup->'meta'->>'exported_by',
    'already_exists', v_exists,
    'counts', jsonb_build_object(
      'employees',         jsonb_array_length(COALESCE(p_backup->'employees',           '[]'::jsonb)),
      'clients',           jsonb_array_length(COALESCE(p_backup->'clients',             '[]'::jsonb)),
      'projects',          jsonb_array_length(COALESCE(p_backup->'projects',            '[]'::jsonb)),
      'todos',             jsonb_array_length(COALESCE(p_backup->'todos',               '[]'::jsonb)),
      'allocations',       jsonb_array_length(COALESCE(p_backup->'resource_allocations','[]'::jsonb)),
      'time_entries',      jsonb_array_length(COALESCE(p_backup->'time_entries',        '[]'::jsonb)),
      'departments',       jsonb_array_length(COALESCE(p_backup->'departments',         '[]'::jsonb)),
      'positions',         jsonb_array_length(COALESCE(p_backup->'agency_positions',    '[]'::jsonb)),
      'calendar_events',   jsonb_array_length(COALESCE(p_backup->'calendar_events',     '[]'::jsonb))
    )
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.peek_backup_super_admin(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_backup_super_admin(JSONB) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 2. Restore — Backup importieren
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.restore_organization_from_backup(JSONB);

CREATE FUNCTION public.restore_organization_from_backup(p_backup JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_org_name  TEXT;
  v_counts    JSONB := '{}'::jsonb;
  v_employees_clean JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  -- Validierung
  IF p_backup IS NULL OR p_backup->'meta' IS NULL THEN
    RAISE EXCEPTION 'Ungültiges Backup: meta fehlt.';
  END IF;

  IF p_backup->'meta'->>'schema_version' <> 'agentur-os/1' THEN
    RAISE EXCEPTION 'Inkompatible Schema-Version: %.', p_backup->'meta'->>'schema_version';
  END IF;

  v_org_id   := (p_backup->'organization'->>'id')::UUID;
  v_org_name := p_backup->'organization'->>'name';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Backup enthält keine gültige Organisation.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
    RAISE EXCEPTION 'Eine Agentur mit dieser ID existiert bereits (%). Lösche sie zuerst.', v_org_name;
  END IF;

  -- Trigger temporär ausschalten (Limits, Status-Enforcement)
  SET LOCAL session_replication_role = 'replica';

  -- 1. Organisation
  INSERT INTO public.organizations
  SELECT * FROM jsonb_populate_record(NULL::public.organizations, p_backup->'organization');

  -- 2. Agency Settings (Singleton pro Org)
  IF p_backup->'agency_settings' IS NOT NULL AND p_backup->'agency_settings' <> 'null'::jsonb THEN
    INSERT INTO public.agency_settings
    SELECT * FROM jsonb_populate_record(NULL::public.agency_settings, p_backup->'agency_settings');
  END IF;

  -- 3. Features
  INSERT INTO public.organization_features
  SELECT * FROM jsonb_populate_recordset(NULL::public.organization_features,
    COALESCE(p_backup->'organization_features', '[]'::jsonb));

  -- 4. Departments
  INSERT INTO public.departments
  SELECT * FROM jsonb_populate_recordset(NULL::public.departments,
    COALESCE(p_backup->'departments', '[]'::jsonb));

  -- 5. Employees — user_id auf NULL setzen + is_super_admin NICHT übernehmen
  --    (Super-Admin-Status wird zentral verwaltet, nicht via Backup)
  SELECT COALESCE(jsonb_agg(
    (elem - 'user_id') || jsonb_build_object('user_id', NULL)
  ), '[]'::jsonb)
  INTO v_employees_clean
  FROM jsonb_array_elements(COALESCE(p_backup->'employees', '[]'::jsonb)) elem;

  INSERT INTO public.employees
  SELECT * FROM jsonb_populate_recordset(NULL::public.employees, v_employees_clean);

  -- 6. Clients + verknüpfte
  INSERT INTO public.clients
  SELECT * FROM jsonb_populate_recordset(NULL::public.clients,
    COALESCE(p_backup->'clients', '[]'::jsonb));

  INSERT INTO public.client_contacts
  SELECT * FROM jsonb_populate_recordset(NULL::public.client_contacts,
    COALESCE(p_backup->'client_contacts', '[]'::jsonb));

  INSERT INTO public.client_logs
  SELECT * FROM jsonb_populate_recordset(NULL::public.client_logs,
    COALESCE(p_backup->'client_logs', '[]'::jsonb));

  -- 7. Agentur-Konfig (vor Projekten, weil time_entries darauf verweisen)
  INSERT INTO public.agency_positions
  SELECT * FROM jsonb_populate_recordset(NULL::public.agency_positions,
    COALESCE(p_backup->'agency_positions', '[]'::jsonb));

  INSERT INTO public.organization_templates
  SELECT * FROM jsonb_populate_recordset(NULL::public.organization_templates,
    COALESCE(p_backup->'organization_templates', '[]'::jsonb));

  -- 8. Projekte + alle untergeordneten
  INSERT INTO public.projects
  SELECT * FROM jsonb_populate_recordset(NULL::public.projects,
    COALESCE(p_backup->'projects', '[]'::jsonb));

  INSERT INTO public.project_sections
  SELECT * FROM jsonb_populate_recordset(NULL::public.project_sections,
    COALESCE(p_backup->'project_sections', '[]'::jsonb));

  INSERT INTO public.project_positions
  SELECT * FROM jsonb_populate_recordset(NULL::public.project_positions,
    COALESCE(p_backup->'project_positions', '[]'::jsonb));

  INSERT INTO public.project_members
  SELECT * FROM jsonb_populate_recordset(NULL::public.project_members,
    COALESCE(p_backup->'project_members', '[]'::jsonb));

  INSERT INTO public.project_invoices
  SELECT * FROM jsonb_populate_recordset(NULL::public.project_invoices,
    COALESCE(p_backup->'project_invoices', '[]'::jsonb));

  INSERT INTO public.project_logs
  SELECT * FROM jsonb_populate_recordset(NULL::public.project_logs,
    COALESCE(p_backup->'project_logs', '[]'::jsonb));

  INSERT INTO public.todos
  SELECT * FROM jsonb_populate_recordset(NULL::public.todos,
    COALESCE(p_backup->'todos', '[]'::jsonb));

  -- 9. Ressourcen
  INSERT INTO public.resource_allocations
  SELECT * FROM jsonb_populate_recordset(NULL::public.resource_allocations,
    COALESCE(p_backup->'resource_allocations', '[]'::jsonb));

  -- 10. Zeiterfassung
  INSERT INTO public.time_entries
  SELECT * FROM jsonb_populate_recordset(NULL::public.time_entries,
    COALESCE(p_backup->'time_entries', '[]'::jsonb));

  -- 11. Kalender
  INSERT INTO public.external_calendars
  SELECT * FROM jsonb_populate_recordset(NULL::public.external_calendars,
    COALESCE(p_backup->'external_calendars', '[]'::jsonb));

  INSERT INTO public.calendar_events
  SELECT * FROM jsonb_populate_recordset(NULL::public.calendar_events,
    COALESCE(p_backup->'calendar_events', '[]'::jsonb));

  -- 12. Registration Requests (selten relevant, aber vollständigkeitshalber)
  INSERT INTO public.registration_requests
  SELECT * FROM jsonb_populate_recordset(NULL::public.registration_requests,
    COALESCE(p_backup->'registration_requests', '[]'::jsonb));

  -- Trigger wieder einschalten
  SET LOCAL session_replication_role = 'origin';

  -- Counts für Response
  v_counts := jsonb_build_object(
    'employees',       jsonb_array_length(COALESCE(p_backup->'employees',           '[]'::jsonb)),
    'clients',         jsonb_array_length(COALESCE(p_backup->'clients',             '[]'::jsonb)),
    'projects',        jsonb_array_length(COALESCE(p_backup->'projects',            '[]'::jsonb)),
    'todos',           jsonb_array_length(COALESCE(p_backup->'todos',               '[]'::jsonb)),
    'allocations',     jsonb_array_length(COALESCE(p_backup->'resource_allocations','[]'::jsonb)),
    'time_entries',    jsonb_array_length(COALESCE(p_backup->'time_entries',        '[]'::jsonb)),
    'calendar_events', jsonb_array_length(COALESCE(p_backup->'calendar_events',     '[]'::jsonb))
  );

  PERFORM log_super_admin_action(
    'organization.restore',
    'organization', v_org_id::TEXT,
    jsonb_build_object(
      'name', v_org_name,
      'exported_at', p_backup->'meta'->>'exported_at',
      'counts', v_counts
    )
  );

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'org_name', v_org_name,
    'counts', v_counts
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.restore_organization_from_backup(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_organization_from_backup(JSONB) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- Schema-Cache reloaden — sonst sieht PostgREST die neuen RPCs nicht
-- ────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
