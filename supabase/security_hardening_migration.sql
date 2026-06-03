-- ============================================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================================
-- Schließt die im Pre-Pilot-Audit gefundenen Lücken. Idempotent. Im Supabase
-- SQL Editor ausführen. Reihenfolge beibehalten.
--
-- Enthält:
--   K1  Privilege-Escalation auf employees (is_super_admin / organization_id / role)
--   H2  external_calendars: Mandanten- → Mitarbeiter-Isolation (persönliche Tokens)
--   H3  client_contacts / client_logs: organization_id NOT NULL absichern
--   H1  start_impersonation: Ziel-Org validieren
-- ============================================================================


-- ────────────────────────────────────────────────────────────────
-- K1 — employees: privilegierte Felder schützen
-- ────────────────────────────────────────────────────────────────
-- Die Policy "employees_org_isolation" erlaubt UPDATE auf alle Zeilen der eigenen
-- Org — inkl. is_super_admin. Damit konnte sich jeder eingeloggte User per
--   supabase.from('employees').update({ is_super_admin: true })
-- selbst zum Super-Admin machen → Vollzugriff auf ALLE Agenturen.
-- Ein BEFORE-Trigger sperrt die privilegierten Felder ab (Policy bleibt wie sie ist,
-- damit normale Profil-/Admin-Updates weiter funktionieren).

CREATE OR REPLACE FUNCTION public.guard_employee_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- Super-Admins (echte, nicht selbst-ernannte) dürfen alles.
  IF is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Niemand darf sich per INSERT eine super-admin-Zeile anlegen.
    IF COALESCE(NEW.is_super_admin, FALSE) THEN
      RAISE EXCEPTION 'Nicht erlaubt: is_super_admin kann nicht gesetzt werden.';
    END IF;
    RETURN NEW;
  END IF;

  -- ── UPDATE ──
  -- is_super_admin niemals durch Nicht-Super-Admins änderbar.
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    RAISE EXCEPTION 'Nicht erlaubt: is_super_admin kann nicht geändert werden.';
  END IF;

  -- organization_id (Tenant-Wechsel) niemals durch Nicht-Super-Admins änderbar.
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Nicht erlaubt: organization_id kann nicht geändert werden.';
  END IF;

  -- role nur durch einen Admin DERSELBEN Organisation änderbar
  -- (verhindert, dass sich ein normaler User selbst zum Admin macht).
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.role = 'admin'
        AND e.organization_id = OLD.organization_id
    ) INTO caller_is_admin;
    IF NOT caller_is_admin THEN
      RAISE EXCEPTION 'Nicht erlaubt: Rollenänderung nur durch Admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_employee_privileges ON public.employees;
CREATE TRIGGER trg_guard_employee_privileges
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_privileges();


-- ────────────────────────────────────────────────────────────────
-- H2 — external_calendars: Mitarbeiter-Isolation
-- ────────────────────────────────────────────────────────────────
-- Bisher konnte jeder Kollege derselben Agentur die OAuth-Tokens / CalDAV-
-- Passwörter aller anderen lesen (Policy nur org-weit). external_calendars sind
-- persönliche Verbindungen → strikt auf den verbundenen Mitarbeiter einschränken.

DROP POLICY IF EXISTS "external_calendars_org_isolation" ON public.external_calendars;
DROP POLICY IF EXISTS "external_calendars_own"           ON public.external_calendars;

CREATE POLICY "external_calendars_own" ON public.external_calendars
  FOR ALL
  USING (
    organization_id = get_my_organization_id()
    AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id = get_my_organization_id()
    AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────────
-- H3 — client_contacts / client_logs: organization_id NOT NULL
-- ────────────────────────────────────────────────────────────────
-- Org-Isolation hängt an dieser Spalte. Nur NOT NULL setzen, wenn keine
-- bestehenden NULL-Werte vorliegen (sonst Hinweis statt Fehler).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='client_contacts' AND column_name='organization_id') THEN
    IF NOT EXISTS (SELECT 1 FROM public.client_contacts WHERE organization_id IS NULL) THEN
      ALTER TABLE public.client_contacts ALTER COLUMN organization_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'client_contacts: organization_id hat NULL-Werte — erst bereinigen, dann NOT NULL setzen.';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='client_logs' AND column_name='organization_id') THEN
    IF NOT EXISTS (SELECT 1 FROM public.client_logs WHERE organization_id IS NULL) THEN
      ALTER TABLE public.client_logs ALTER COLUMN organization_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'client_logs: organization_id hat NULL-Werte — erst bereinigen, dann NOT NULL setzen.';
    END IF;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- H1 — start_impersonation: Ziel-Organisation validieren
-- ────────────────────────────────────────────────────────────────
-- Zusätzlich zum is_super_admin()-Check (durch K1 jetzt nicht mehr selbst
-- erlangbar) wird geprüft, dass die Ziel-Org existiert.

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

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_target_org_id) THEN
    RAISE EXCEPTION 'Ziel-Organisation existiert nicht.';
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


-- PostgREST-Schema neu laden
NOTIFY pgrst, 'reload schema';
