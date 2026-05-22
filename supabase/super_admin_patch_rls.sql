-- ================================================================
-- AGENTUR OS — Super Admin Panel: Patch für RLS + Detail-Counts
-- Im Supabase SQL Editor ausführen
-- ================================================================
-- Behebt: 406 Not Acceptable beim Öffnen fremder Agenturen
--
-- Problem:
--   Die Policy "organizations_own_only" erlaubt jedem User nur seine
--   eigene Org zu sehen. Super-Admin braucht aber Lesezugriff auf
--   alle Agenturen + ihre Detail-Counts.
--
-- Lösung:
--   1. Zusätzliche SELECT-Policy auf organizations für Super-Admin
--   2. RPC get_org_usage_super_admin() für Detail-Counts
--      (umgeht RLS auf projects/clients/allocations/time_entries)
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. SELECT-Policy auf organizations für Super-Admin
-- ────────────────────────────────────────────────────────────────
-- Mehrere PERMISSIVE Policies werden mit OR kombiniert — die bestehende
-- "organizations_own_only" bleibt unverändert, wir legen eine
-- zusätzliche reine SELECT-Policy für Super-Admins drüber.

DROP POLICY IF EXISTS "organizations_super_admin_read" ON public.organizations;
CREATE POLICY "organizations_super_admin_read" ON public.organizations
  FOR SELECT
  USING (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 2. RPC: Detail-Counts für eine bestimmte Agentur
-- ────────────────────────────────────────────────────────────────
-- Wird im Frontend für den "Nutzung"-Tab + die Übersicht-Karten
-- aufgerufen. Liefert alle Counts in einem Roundtrip.

CREATE OR REPLACE FUNCTION public.get_org_usage_super_admin(p_org_id UUID)
RETURNS TABLE(
  employee_count          BIGINT,
  project_count           BIGINT,
  client_count            BIGINT,
  allocation_count        BIGINT,
  time_entries_week       BIGINT,
  time_entries_total      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.employees           WHERE organization_id = p_org_id),
    (SELECT COUNT(*) FROM public.projects            WHERE organization_id = p_org_id),
    (SELECT COUNT(*) FROM public.clients             WHERE organization_id = p_org_id),
    (SELECT COUNT(*) FROM public.resource_allocations WHERE organization_id = p_org_id),
    (SELECT COUNT(*) FROM public.time_entries
       WHERE EXISTS (
         SELECT 1 FROM public.employees e
         WHERE e.id = time_entries.employee_id
           AND e.organization_id = p_org_id
       )
       AND date >= (CURRENT_DATE - INTERVAL '7 days')),
    (SELECT COUNT(*) FROM public.time_entries
       WHERE EXISTS (
         SELECT 1 FROM public.employees e
         WHERE e.id = time_entries.employee_id
           AND e.organization_id = p_org_id
       ));
END;
$$;

REVOKE ALL  ON FUNCTION public.get_org_usage_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_usage_super_admin(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 3. RPC: Eine einzelne Agentur per ID (für Detail-Page)
-- ────────────────────────────────────────────────────────────────
-- Liefert Org + Counts in einem Roundtrip. Spart einen extra Call.

CREATE OR REPLACE FUNCTION public.get_organization_super_admin(p_org_id UUID)
RETURNS TABLE(
  id              UUID,
  name            TEXT,
  slug            TEXT,
  industry        TEXT,
  plan            TEXT,
  status          TEXT,
  max_employees   INTEGER,
  max_projects    INTEGER,
  notes           TEXT,
  trial_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  last_active_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.industry, o.plan, o.status,
         o.max_employees, o.max_projects, o.notes,
         o.trial_ends_at, o.created_at, o.last_active_at
  FROM public.organizations o
  WHERE o.id = p_org_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.get_organization_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_super_admin(UUID) TO authenticated;
