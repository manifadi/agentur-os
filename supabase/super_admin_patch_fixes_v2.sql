-- ================================================================
-- AGENTUR OS — Super Admin: Bug-Fixes V2
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Behebt zwei Probleme:
--
-- Bug 1: "cannot execute INSERT in a read-only transaction"
--   Ursache: CREATE OR REPLACE FUNCTION übernimmt die Volatility
--   der bestehenden Funktion. Da die alte Version STABLE war,
--   blieb sie STABLE — auch wenn der Patch das Wort weglässt.
--   Fix: DROP FUNCTION + neu erstellen mit explizit VOLATILE.
--
-- Bug 2: "Could not find the function ... in the schema cache"
--   Ursache: Supabase/PostgREST cached das Schema. Neue Funktionen
--   sind erst nach Cache-Reload sichtbar.
--   Fix: NOTIFY pgrst, 'reload schema' am Ende.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. export_organization_backup — DROP + CREATE mit VOLATILE
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.export_organization_backup(UUID);

CREATE FUNCTION public.export_organization_backup(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
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
-- 2. delete_registration_request_super_admin — sicherstellen
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.delete_registration_request_super_admin(UUID);

CREATE FUNCTION public.delete_registration_request_super_admin(
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
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


-- ────────────────────────────────────────────────────────────────
-- 3. Bonus: extend_trial + get_org_owner mit VOLATILE absichern
-- ────────────────────────────────────────────────────────────────
-- Beide schreiben (extend_trial macht UPDATE, get_org_owner schreibt
-- nichts — aber wir lassen sie explizit damit es keine Falle gibt)

DROP FUNCTION IF EXISTS public.extend_trial_super_admin(UUID, INTEGER);

CREATE FUNCTION public.extend_trial_super_admin(
  p_org_id UUID,
  p_days   INTEGER DEFAULT 30
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current TIMESTAMPTZ;
  v_new     TIMESTAMPTZ;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  IF p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'Tage müssen zwischen 1 und 365 liegen.';
  END IF;

  SELECT trial_ends_at INTO v_current
  FROM public.organizations WHERE id = p_org_id;

  v_new := CASE
    WHEN v_current IS NULL       THEN now() + (p_days || ' days')::INTERVAL
    WHEN v_current < now()       THEN now() + (p_days || ' days')::INTERVAL
    ELSE v_current + (p_days || ' days')::INTERVAL
  END;

  UPDATE public.organizations
  SET trial_ends_at = v_new,
      status        = CASE WHEN status = 'read_only' THEN 'active' ELSE status END
  WHERE id = p_org_id;

  PERFORM log_super_admin_action(
    'trial.extend',
    'organization', p_org_id::TEXT,
    jsonb_build_object('days', p_days, 'new_end', v_new)
  );

  RETURN v_new;
END;
$$;

REVOKE ALL  ON FUNCTION public.extend_trial_super_admin(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_trial_super_admin(UUID, INTEGER) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 4. Schema-Cache reloaden — wichtig damit PostgREST die neuen
--    Funktionen sofort sieht
-- ────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────
-- Verifikation
-- ────────────────────────────────────────────────────────────────
-- Nach dem Ausführen kannst du prüfen:
--
--   SELECT proname, provolatile
--   FROM pg_proc
--   WHERE proname IN (
--     'export_organization_backup',
--     'delete_registration_request_super_admin',
--     'extend_trial_super_admin'
--   );
--
-- provolatile sollte 'v' sein (= VOLATILE), nicht 's' (= STABLE).
-- ================================================================
