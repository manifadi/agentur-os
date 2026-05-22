-- ================================================================
-- AGENTUR OS — Super Admin: Bug-Fixes
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Fix 1: export_organization_backup darf nicht STABLE sein, weil
--        sie via log_super_admin_action INSERTet → "cannot execute
--        INSERT in a read-only transaction".
--
-- Fix 2: Neue RPC zum harten Löschen einer Registrierungs-Anfrage
--        (DELETE statt status='rejected'). Vorher konnte man Anfragen
--        ohne Org-Zuweisung nicht wegbekommen.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- Fix 1: export_organization_backup — STABLE entfernen
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.export_organization_backup(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Agentur nicht gefunden.';
  END IF;

  v_result := jsonb_build_object(
    'meta', jsonb_build_object(
      'exported_at',     now(),
      'exported_by',     auth.email(),
      'org_id',          p_org_id,
      'schema_version',  'agentur-os/1'
    ),

    'organization',
      (SELECT to_jsonb(o.*) FROM public.organizations o WHERE o.id = p_org_id),

    'agency_settings',
      (SELECT to_jsonb(s.*) FROM public.agency_settings s WHERE s.organization_id = p_org_id),

    'organization_features',
      COALESCE((SELECT jsonb_agg(to_jsonb(f.*))
                FROM public.organization_features f
                WHERE f.organization_id = p_org_id), '[]'::jsonb),

    'departments',
      COALESCE((SELECT jsonb_agg(to_jsonb(d.*))
                FROM public.departments d
                WHERE d.organization_id = p_org_id), '[]'::jsonb),

    'employees',
      COALESCE((SELECT jsonb_agg(to_jsonb(e.*))
                FROM public.employees e
                WHERE e.organization_id = p_org_id), '[]'::jsonb),

    'clients',
      COALESCE((SELECT jsonb_agg(to_jsonb(c.*))
                FROM public.clients c
                WHERE c.organization_id = p_org_id), '[]'::jsonb),

    'client_contacts',
      COALESCE((SELECT jsonb_agg(to_jsonb(cc.*))
                FROM public.client_contacts cc
                WHERE cc.organization_id = p_org_id), '[]'::jsonb),

    'client_logs',
      COALESCE((SELECT jsonb_agg(to_jsonb(cl.*))
                FROM public.client_logs cl
                WHERE cl.organization_id = p_org_id), '[]'::jsonb),

    'projects',
      COALESCE((SELECT jsonb_agg(to_jsonb(p.*))
                FROM public.projects p
                WHERE p.organization_id = p_org_id), '[]'::jsonb),

    'todos',
      COALESCE((SELECT jsonb_agg(to_jsonb(t.*))
                FROM public.todos t
                WHERE t.organization_id = p_org_id), '[]'::jsonb),

    'project_logs',
      COALESCE((SELECT jsonb_agg(to_jsonb(pl.*))
                FROM public.project_logs pl
                WHERE pl.organization_id = p_org_id), '[]'::jsonb),

    'project_sections',
      COALESCE((SELECT jsonb_agg(to_jsonb(ps.*))
                FROM public.project_sections ps
                WHERE ps.organization_id = p_org_id), '[]'::jsonb),

    'project_positions',
      COALESCE((SELECT jsonb_agg(to_jsonb(pp.*))
                FROM public.project_positions pp
                WHERE pp.organization_id = p_org_id), '[]'::jsonb),

    'project_members',
      COALESCE((SELECT jsonb_agg(to_jsonb(pm.*))
                FROM public.project_members pm
                WHERE EXISTS (
                  SELECT 1 FROM public.projects p
                  WHERE p.id = pm.project_id AND p.organization_id = p_org_id
                )), '[]'::jsonb),

    'project_invoices',
      COALESCE((SELECT jsonb_agg(to_jsonb(pi.*))
                FROM public.project_invoices pi
                WHERE pi.organization_id = p_org_id), '[]'::jsonb),

    'resource_allocations',
      COALESCE((SELECT jsonb_agg(to_jsonb(ra.*))
                FROM public.resource_allocations ra
                WHERE ra.organization_id = p_org_id), '[]'::jsonb),

    'agency_positions',
      COALESCE((SELECT jsonb_agg(to_jsonb(ap.*))
                FROM public.agency_positions ap
                WHERE ap.organization_id = p_org_id), '[]'::jsonb),

    'organization_templates',
      COALESCE((SELECT jsonb_agg(to_jsonb(ot.*))
                FROM public.organization_templates ot
                WHERE ot.organization_id = p_org_id), '[]'::jsonb),

    'time_entries',
      COALESCE((SELECT jsonb_agg(to_jsonb(te.*))
                FROM public.time_entries te
                WHERE EXISTS (
                  SELECT 1 FROM public.employees e
                  WHERE e.id = te.employee_id AND e.organization_id = p_org_id
                )), '[]'::jsonb),

    'calendar_events',
      COALESCE((SELECT jsonb_agg(to_jsonb(ce.*))
                FROM public.calendar_events ce
                WHERE EXISTS (
                  SELECT 1 FROM public.employees e
                  WHERE e.id = ce.employee_id AND e.organization_id = p_org_id
                )), '[]'::jsonb),

    'external_calendars',
      COALESCE((SELECT jsonb_agg(to_jsonb(ec.*))
                FROM public.external_calendars ec
                WHERE EXISTS (
                  SELECT 1 FROM public.employees e
                  WHERE e.id = ec.employee_id AND e.organization_id = p_org_id
                )), '[]'::jsonb),

    'registration_requests',
      COALESCE((SELECT jsonb_agg(to_jsonb(rr.*))
                FROM public.registration_requests rr
                WHERE rr.organization_id = p_org_id), '[]'::jsonb)
  );

  PERFORM log_super_admin_action(
    'organization.backup',
    'organization', p_org_id::TEXT,
    jsonb_build_object('size_bytes', octet_length(v_result::text))
  );

  RETURN v_result;
END;
$$;

REVOKE ALL  ON FUNCTION public.export_organization_backup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_organization_backup(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- Fix 2: Registrierungs-Anfrage hart löschen
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_registration_request_super_admin(
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_name  TEXT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT email, name INTO v_email, v_name
  FROM public.registration_requests WHERE id = p_request_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Anfrage nicht gefunden.';
  END IF;

  DELETE FROM public.registration_requests WHERE id = p_request_id;

  PERFORM log_super_admin_action(
    'request.delete',
    'registration_request', p_request_id::TEXT,
    jsonb_build_object('email', v_email, 'name', v_name)
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.delete_registration_request_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_registration_request_super_admin(UUID) TO authenticated;
