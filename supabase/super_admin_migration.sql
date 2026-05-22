-- ================================================================
-- AGENTUR OS — Super Admin Panel: Foundation Migration
-- Im Supabase SQL Editor ausführen
-- ================================================================
-- Idempotent: kann mehrfach ausgeführt werden.
--
-- Was diese Migration macht:
--   1. Dediziertes is_super_admin-Flag auf employees (statt role-Missbrauch)
--   2. organizations: plan, status, slug, industry, limits, notes, timestamps
--   3. Neue Tabellen: organization_features, super_admin_audit_log,
--                     impersonation_sessions
--   4. get_my_organization_id() respektiert aktive Impersonation
--   5. RPCs für alle Super-Admin-Aktionen (alle mit Audit-Logging)
--   6. Hard-Limit-Trigger auf employees/projects
--   7. Super-Admin-RLS-Bypass für globale Lesezugriffe
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. is_super_admin-Flag auf employees
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_employees_super_admin
  ON public.employees (is_super_admin) WHERE is_super_admin = TRUE;

-- Helper, der überall verwendet wird
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.employees WHERE user_id = auth.uid() LIMIT 1),
    FALSE
  );
$$;


-- ────────────────────────────────────────────────────────────────
-- 2. organizations erweitern
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug          TEXT,
  ADD COLUMN IF NOT EXISTS industry      TEXT,
  ADD COLUMN IF NOT EXISTS plan          TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS max_employees INTEGER,
  ADD COLUMN IF NOT EXISTS max_projects  INTEGER,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Plan-Check (trial / pro / agency / internal)
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('trial', 'pro', 'agency', 'internal'));

-- Status-Check (active / read_only / suspended)
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('active', 'read_only', 'suspended'));

-- Slug-Uniqueness (nullable, aber unique wenn gesetzt)
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique
  ON public.organizations (LOWER(slug)) WHERE slug IS NOT NULL;


-- ────────────────────────────────────────────────────────────────
-- 3. organization_features
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_features (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key     TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id),
  PRIMARY KEY (organization_id, feature_key)
);

ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_features_read" ON public.organization_features;
CREATE POLICY "org_features_read" ON public.organization_features
  FOR SELECT
  USING (
    organization_id = get_my_organization_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "org_features_write_super_admin" ON public.organization_features;
CREATE POLICY "org_features_write_super_admin" ON public.organization_features
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 4. super_admin_audit_log
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id),
  actor_email   TEXT,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON public.super_admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action
  ON public.super_admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_target
  ON public.super_admin_audit_log (target_type, target_id);

ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_super_admin_only" ON public.super_admin_audit_log;
CREATE POLICY "audit_log_super_admin_only" ON public.super_admin_audit_log
  FOR SELECT USING (is_super_admin());

-- Interne Hilfsfunktion: schreibt einen Audit-Eintrag
CREATE OR REPLACE FUNCTION public.log_super_admin_action(
  p_action      TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id   TEXT DEFAULT NULL,
  p_payload     JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.super_admin_audit_log
    (actor_user_id, actor_email, action, target_type, target_id, payload)
  VALUES
    (auth.uid(), auth.email(), p_action, p_target_type, p_target_id, p_payload);
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 5. impersonation_sessions
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  actor_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_org_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  PRIMARY KEY (actor_user_id)
);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impersonation_self_or_super_admin" ON public.impersonation_sessions;
CREATE POLICY "impersonation_self_or_super_admin" ON public.impersonation_sessions
  FOR SELECT
  USING (actor_user_id = auth.uid() OR is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 6. get_my_organization_id() — Impersonation-aware
-- ────────────────────────────────────────────────────────────────
-- Wenn der eingeloggte User aktiv eine andere Org impersoniert,
-- geben wir die Ziel-Org statt der echten zurück. Dadurch greift
-- automatisch jede bestehende RLS-Policy auf die Ziel-Org.

CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_own    UUID;
BEGIN
  -- Aktive Impersonation hat Vorrang
  SELECT target_org_id INTO v_target
  FROM public.impersonation_sessions
  WHERE actor_user_id = auth.uid()
    AND expires_at > now()
  LIMIT 1;

  IF v_target IS NOT NULL THEN
    RETURN v_target;
  END IF;

  -- Normaler Lookup
  SELECT organization_id INTO v_own
  FROM public.employees
  WHERE user_id = auth.uid()
  LIMIT 1;

  RETURN v_own;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 7. RPC: Übersicht (Liste aller Orgs + Counts) für Super Admin
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_super_admin_overview()
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
  last_active_at  TIMESTAMPTZ,
  employee_count  BIGINT,
  project_count   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.name, o.slug, o.industry, o.plan, o.status,
    o.max_employees, o.max_projects, o.notes,
    o.trial_ends_at, o.created_at, o.last_active_at,
    (SELECT COUNT(*) FROM public.employees e WHERE e.organization_id = o.id),
    (SELECT COUNT(*) FROM public.projects p WHERE p.organization_id = o.id)
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 8. RPC: Neue Agentur + Owner anlegen + Invite vorbereiten
-- ────────────────────────────────────────────────────────────────
-- Erzeugt Org, AgencySettings, Owner-Employee (ohne user_id —
-- der wird beim ersten Login via link_invited_employee() gesetzt).
-- Gibt zurück: org_id, owner_employee_id

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name           TEXT,
  p_slug           TEXT DEFAULT NULL,
  p_industry       TEXT DEFAULT NULL,
  p_plan           TEXT DEFAULT 'trial',
  p_max_employees  INTEGER DEFAULT NULL,
  p_max_projects   INTEGER DEFAULT NULL,
  p_notes          TEXT DEFAULT NULL,
  p_owner_name     TEXT DEFAULT NULL,
  p_owner_email    TEXT DEFAULT NULL,
  p_trial_days     INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_emp_id    UUID;
  v_initials  TEXT;
  v_parts     TEXT[];
  v_trial_end TIMESTAMPTZ;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    RAISE EXCEPTION 'Agentur-Name ist erforderlich.';
  END IF;

  v_trial_end := CASE WHEN p_plan = 'trial' THEN now() + (p_trial_days || ' days')::INTERVAL ELSE NULL END;

  INSERT INTO public.organizations
    (name, slug, industry, plan, max_employees, max_projects, notes, trial_ends_at)
  VALUES
    (TRIM(p_name), NULLIF(TRIM(p_slug), ''), NULLIF(TRIM(p_industry), ''),
     p_plan, p_max_employees, p_max_projects, NULLIF(TRIM(p_notes), ''), v_trial_end)
  RETURNING id INTO v_org_id;

  INSERT INTO public.agency_settings (
    organization_id, company_name, address, tax_id, bank_name,
    iban, bic, commercial_register, footer_text, logo_url
  ) VALUES (
    v_org_id, TRIM(p_name), '', '', '', '', '', '', '', ''
  );

  -- Owner als Employee anlegen (user_id wird beim ersten Login verknüpft)
  IF p_owner_email IS NOT NULL AND LENGTH(TRIM(p_owner_email)) > 0 THEN
    v_parts := STRING_TO_ARRAY(TRIM(COALESCE(p_owner_name, p_owner_email)), ' ');
    v_initials := UPPER(
      CASE
        WHEN ARRAY_LENGTH(v_parts, 1) >= 2
          THEN LEFT(v_parts[1], 1) || LEFT(v_parts[2], 1)
        ELSE LEFT(v_parts[1], 2)
      END
    );

    INSERT INTO public.employees (name, email, initials, organization_id, role)
    VALUES (TRIM(COALESCE(p_owner_name, p_owner_email)), LOWER(TRIM(p_owner_email)),
            v_initials, v_org_id, 'admin')
    RETURNING id INTO v_emp_id;
  END IF;

  PERFORM log_super_admin_action(
    'organization.create',
    'organization', v_org_id::TEXT,
    jsonb_build_object(
      'name', p_name, 'plan', p_plan,
      'owner_email', p_owner_email,
      'max_employees', p_max_employees, 'max_projects', p_max_projects
    )
  );

  RETURN jsonb_build_object('org_id', v_org_id, 'owner_employee_id', v_emp_id);
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 9. RPC: Mitarbeiter zu Org einladen (ohne Approval-Flow)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_employee_to_org(
  p_org_id  UUID,
  p_name    TEXT,
  p_email   TEXT,
  p_role    TEXT DEFAULT 'user'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id   UUID;
  v_initials TEXT;
  v_parts    TEXT[];
  v_count    INTEGER;
  v_limit    INTEGER;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  IF p_email IS NULL OR LENGTH(TRIM(p_email)) = 0 THEN
    RAISE EXCEPTION 'E-Mail erforderlich.';
  END IF;

  -- Hard-Limit prüfen
  SELECT max_employees INTO v_limit FROM public.organizations WHERE id = p_org_id;
  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.employees WHERE organization_id = p_org_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Mitarbeiter-Limit erreicht (% / %).', v_count, v_limit;
    END IF;
  END IF;

  -- Duplikat-Check
  IF EXISTS (
    SELECT 1 FROM public.employees
    WHERE organization_id = p_org_id AND LOWER(email) = LOWER(TRIM(p_email))
  ) THEN
    RAISE EXCEPTION 'Mitarbeiter mit dieser E-Mail existiert bereits in dieser Agentur.';
  END IF;

  v_parts := STRING_TO_ARRAY(TRIM(COALESCE(p_name, p_email)), ' ');
  v_initials := UPPER(
    CASE
      WHEN ARRAY_LENGTH(v_parts, 1) >= 2
        THEN LEFT(v_parts[1], 1) || LEFT(v_parts[2], 1)
      ELSE LEFT(v_parts[1], 2)
    END
  );

  INSERT INTO public.employees (name, email, initials, organization_id, role)
  VALUES (TRIM(COALESCE(p_name, p_email)), LOWER(TRIM(p_email)),
          v_initials, p_org_id, COALESCE(p_role, 'user'))
  RETURNING id INTO v_emp_id;

  PERFORM log_super_admin_action(
    'employee.invite',
    'employee', v_emp_id::TEXT,
    jsonb_build_object('org_id', p_org_id, 'email', p_email, 'role', p_role)
  );

  RETURN v_emp_id;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 10. RPC: Feature-Flag toggeln
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_org_feature(
  p_org_id      UUID,
  p_feature_key TEXT,
  p_enabled     BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  INSERT INTO public.organization_features (organization_id, feature_key, enabled, updated_by)
  VALUES (p_org_id, p_feature_key, p_enabled, auth.uid())
  ON CONFLICT (organization_id, feature_key)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now(), updated_by = auth.uid();

  PERFORM log_super_admin_action(
    'feature.set',
    'organization', p_org_id::TEXT,
    jsonb_build_object('feature_key', p_feature_key, 'enabled', p_enabled)
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 11. RPC: Org-Status / Stammdaten / Limits aktualisieren
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_organization_super_admin(
  p_org_id        UUID,
  p_name          TEXT DEFAULT NULL,
  p_slug          TEXT DEFAULT NULL,
  p_industry      TEXT DEFAULT NULL,
  p_plan          TEXT DEFAULT NULL,
  p_status        TEXT DEFAULT NULL,
  p_max_employees INTEGER DEFAULT NULL,
  p_max_projects  INTEGER DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  UPDATE public.organizations SET
    name          = COALESCE(p_name, name),
    slug          = COALESCE(NULLIF(TRIM(p_slug), ''), slug),
    industry      = COALESCE(p_industry, industry),
    plan          = COALESCE(p_plan, plan),
    status        = COALESCE(p_status, status),
    max_employees = COALESCE(p_max_employees, max_employees),
    max_projects  = COALESCE(p_max_projects, max_projects),
    notes         = COALESCE(p_notes, notes),
    trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at)
  WHERE id = p_org_id;

  PERFORM log_super_admin_action(
    'organization.update',
    'organization', p_org_id::TEXT,
    jsonb_build_object(
      'name', p_name, 'plan', p_plan, 'status', p_status,
      'max_employees', p_max_employees, 'max_projects', p_max_projects
    )
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 12. RPC: Mitarbeiter-Rolle updaten + entfernen (cross-org)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_employee_role_super_admin(
  target_employee_id UUID,
  new_role           TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  UPDATE public.employees SET role = new_role WHERE id = target_employee_id;

  PERFORM log_super_admin_action(
    'employee.role',
    'employee', target_employee_id::TEXT,
    jsonb_build_object('role', new_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_employee_super_admin(
  target_employee_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_org   UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT email, organization_id INTO v_email, v_org
  FROM public.employees WHERE id = target_employee_id;

  DELETE FROM public.employees WHERE id = target_employee_id;

  PERFORM log_super_admin_action(
    'employee.remove',
    'employee', target_employee_id::TEXT,
    jsonb_build_object('email', v_email, 'org_id', v_org)
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 13. RPC: Alle Mitarbeiter (Super-Admin-View)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_all_employees_super_admin()
RETURNS SETOF public.employees
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  RETURN QUERY SELECT * FROM public.employees ORDER BY name;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 14. RPC: Impersonation start / stop
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.start_impersonation(
  p_target_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  INSERT INTO public.impersonation_sessions (actor_user_id, target_org_id)
  VALUES (auth.uid(), p_target_org_id)
  ON CONFLICT (actor_user_id)
  DO UPDATE SET target_org_id = EXCLUDED.target_org_id,
                started_at    = now(),
                expires_at    = now() + INTERVAL '2 hours';

  PERFORM log_super_admin_action(
    'impersonation.start',
    'organization', p_target_org_id::TEXT,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_impersonation()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
BEGIN
  SELECT target_org_id INTO v_target
  FROM public.impersonation_sessions WHERE actor_user_id = auth.uid();

  DELETE FROM public.impersonation_sessions WHERE actor_user_id = auth.uid();

  IF v_target IS NOT NULL THEN
    PERFORM log_super_admin_action(
      'impersonation.stop',
      'organization', v_target::TEXT,
      NULL
    );
  END IF;
END;
$$;

-- Aktuelle Impersonation prüfen (Frontend-Banner)
CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS TABLE(
  target_org_id   UUID,
  target_org_name TEXT,
  started_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT i.target_org_id, o.name, i.started_at, i.expires_at
  FROM public.impersonation_sessions i
  JOIN public.organizations o ON o.id = i.target_org_id
  WHERE i.actor_user_id = auth.uid()
    AND i.expires_at > now();
$$;


-- ────────────────────────────────────────────────────────────────
-- 15. RPC: Agentur löschen (Hard-Delete mit Kaskade)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_organization_super_admin(
  p_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT name INTO v_name FROM public.organizations WHERE id = p_org_id;

  -- Kaskade über alle Tabellen mit organization_id
  DELETE FROM public.employees WHERE organization_id = p_org_id;
  DELETE FROM public.projects WHERE organization_id = p_org_id;
  DELETE FROM public.clients WHERE organization_id = p_org_id;
  DELETE FROM public.organization_features WHERE organization_id = p_org_id;
  DELETE FROM public.agency_settings WHERE organization_id = p_org_id;
  DELETE FROM public.organizations WHERE id = p_org_id;

  PERFORM log_super_admin_action(
    'organization.delete',
    'organization', p_org_id::TEXT,
    jsonb_build_object('name', v_name)
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 16. Hard-Limit-Trigger: employees / projects
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_employee_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT max_employees INTO v_limit
  FROM public.organizations WHERE id = NEW.organization_id;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.employees WHERE organization_id = NEW.organization_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Mitarbeiter-Limit für diese Agentur erreicht (% / %).', v_count, v_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_employee_limit ON public.employees;
CREATE TRIGGER trg_enforce_employee_limit
  BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_limit();

CREATE OR REPLACE FUNCTION public.enforce_project_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT max_projects INTO v_limit
  FROM public.organizations WHERE id = NEW.organization_id;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.projects WHERE organization_id = NEW.organization_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Projekt-Limit für diese Agentur erreicht (% / %).', v_count, v_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_limit ON public.projects;
CREATE TRIGGER trg_enforce_project_limit
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_limit();


-- ────────────────────────────────────────────────────────────────
-- 17. Status-Enforcement: 'suspended' / 'read_only' blockt Mutationen
-- ────────────────────────────────────────────────────────────────
-- Wir blockieren Mutationen auf den wichtigsten Tabellen, wenn die
-- Agentur suspended oder read_only ist. Super-Admin bleibt davon
-- ausgenommen (kann jederzeit Daten reparieren).

CREATE OR REPLACE FUNCTION public.enforce_org_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_org    UUID;
BEGIN
  IF is_super_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_org := COALESCE(NEW.organization_id, OLD.organization_id);
  SELECT status INTO v_status FROM public.organizations WHERE id = v_org;

  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Diese Agentur ist gesperrt. Bitte kontaktiere den Support.';
  END IF;

  IF v_status = 'read_only' AND TG_OP <> 'SELECT' THEN
    RAISE EXCEPTION 'Diese Agentur befindet sich im Read-Only-Modus.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_status_projects ON public.projects;
CREATE TRIGGER trg_enforce_status_projects
  BEFORE INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_status();

DROP TRIGGER IF EXISTS trg_enforce_status_todos ON public.todos;
CREATE TRIGGER trg_enforce_status_todos
  BEFORE INSERT OR UPDATE OR DELETE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_status();

DROP TRIGGER IF EXISTS trg_enforce_status_time_entries ON public.time_entries;
CREATE TRIGGER trg_enforce_status_time_entries
  BEFORE INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_status();

DROP TRIGGER IF EXISTS trg_enforce_status_allocations ON public.resource_allocations;
CREATE TRIGGER trg_enforce_status_allocations
  BEFORE INSERT OR UPDATE OR DELETE ON public.resource_allocations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_status();


-- ────────────────────────────────────────────────────────────────
-- 18. last_active_at automatisch pflegen
-- ────────────────────────────────────────────────────────────────
-- Wird via Trigger auf time_entries und projects gesetzt.

CREATE OR REPLACE FUNCTION public.touch_org_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.organizations SET last_active_at = now()
  WHERE id = NEW.organization_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_org_time_entries ON public.time_entries;
CREATE TRIGGER trg_touch_org_time_entries
  AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_org_last_active();

DROP TRIGGER IF EXISTS trg_touch_org_projects ON public.projects;
CREATE TRIGGER trg_touch_org_projects
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_org_last_active();


-- ────────────────────────────────────────────────────────────────
-- 19. Grants
-- ────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.is_super_admin                              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_super_admin_overview                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_organization_with_owner              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_employee_to_org                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_org_feature                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_organization_super_admin             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_role_super_admin            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_employee_super_admin                 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_all_employees_super_admin               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_impersonation                         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stop_impersonation                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_impersonation                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_organization_super_admin             FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_super_admin                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_overview                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner           TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_employee_to_org                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_feature                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_organization_super_admin          TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_role_super_admin         TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_employee_super_admin              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_employees_super_admin            TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_impersonation                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_impersonation                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_impersonation                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization_super_admin          TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 20. WICHTIG — Ersten Super-Admin manuell setzen
-- ────────────────────────────────────────────────────────────────
-- Nach Ausführen dieser Migration, deinen eigenen Account zum
-- Super-Admin machen. E-Mail anpassen:
--
--   UPDATE public.employees
--   SET is_super_admin = TRUE
--   WHERE LOWER(email) = LOWER('j.bauernfeind@icloud.com');
--
-- Verifikation:
--   SELECT name, email, is_super_admin FROM public.employees
--   WHERE is_super_admin = TRUE;
-- ================================================================
