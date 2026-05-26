-- ================================================================
-- AGENTUR OS — Abwesenheits-Management (Urlaub, Krank, Homeoffice)
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Features:
--   - Urlaub mit Genehmigungs-Flow (Manager → Fallback Admins)
--   - Krankmeldung ohne Approval
--   - Homeoffice Self-Service
--   - Anteiliger Jahresanspruch + manueller Übertrag
--   - Storno vor Start: MA selbst; nach Start: Manager/Admin
--   - Feiertags-Handling im Frontend (date-holidays Lib)
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. employees erweitern: manager_id, Urlaubs-Felder
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id              UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vacation_days_per_year  INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS carryover_days          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at              DATE;

-- Plausibilitätschecks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_vacation_days_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_vacation_days_check
      CHECK (vacation_days_per_year BETWEEN 0 AND 365);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- 2. agency_settings: country_code + federal_state (für Feiertage)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS country_code  TEXT NOT NULL DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS federal_state TEXT;


-- ────────────────────────────────────────────────────────────────
-- 3. Tabelle: absences
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.absences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  type            TEXT NOT NULL CHECK (type IN ('vacation', 'sick', 'home_office', 'other')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  half_day        TEXT NOT NULL DEFAULT 'none' CHECK (half_day IN ('none', 'start', 'end')),

  status          TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled')),

  reason          TEXT,
  notes           TEXT,

  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ,
  decided_by      UUID REFERENCES public.employees(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (end_date >= start_date),
  -- Halbe Tage nur an Einzeltagen sinnvoll
  CHECK (half_day = 'none' OR start_date = end_date)
);

CREATE INDEX IF NOT EXISTS idx_absences_employee_dates
  ON public.absences (employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_org_status
  ON public.absences (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_absences_type
  ON public.absences (type);


-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_absence_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_absences_touch_updated_at ON public.absences;
CREATE TRIGGER trg_absences_touch_updated_at
  BEFORE UPDATE ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.touch_absence_updated_at();


-- ────────────────────────────────────────────────────────────────
-- 4. RLS — Org-Isolation + Super-Admin Read
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absences_org_isolation" ON public.absences;
CREATE POLICY "absences_org_isolation" ON public.absences
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

DROP POLICY IF EXISTS "absences_super_admin_read" ON public.absences;
CREATE POLICY "absences_super_admin_read" ON public.absences
  FOR SELECT USING (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 5. Helper: ermittelt die Empfänger der Genehmigungs-Anfrage
-- ────────────────────────────────────────────────────────────────
-- Manager des MA → wenn nicht gesetzt: alle Admins der Org

CREATE OR REPLACE FUNCTION public.absence_approvers(p_employee_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_id UUID;
  v_org_id     UUID;
BEGIN
  SELECT manager_id, organization_id INTO v_manager_id, v_org_id
  FROM public.employees WHERE id = p_employee_id;

  IF v_manager_id IS NOT NULL THEN
    RETURN QUERY SELECT v_manager_id;
  ELSE
    RETURN QUERY
      SELECT id FROM public.employees
      WHERE organization_id = v_org_id AND role = 'admin';
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 6. RPC: Abwesenheit anlegen / anfragen
-- ────────────────────────────────────────────────────────────────
-- - Krank/Homeoffice: direkt approved
-- - Urlaub/Other: status='requested', wartet auf Approval
-- - Self-only: MA legt für sich an. Manager/Admin können für andere anlegen.

DROP FUNCTION IF EXISTS public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TEXT);

CREATE FUNCTION public.request_absence(
  p_employee_id UUID,
  p_type        TEXT,
  p_start_date  DATE,
  p_end_date    DATE,
  p_half_day    TEXT DEFAULT 'none',
  p_reason      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_org_id      UUID;
  v_emp_org     UUID;
  v_status      TEXT;
  v_id          UUID;
BEGIN
  -- Auflöser
  SELECT id, role, organization_id INTO v_caller_id, v_caller_role, v_org_id
  FROM public.employees WHERE user_id = auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  -- Ziel-Mitarbeiter prüfen
  SELECT organization_id INTO v_emp_org
  FROM public.employees WHERE id = p_employee_id;

  IF v_emp_org IS NULL OR v_emp_org <> v_org_id THEN
    RAISE EXCEPTION 'Mitarbeiter nicht gefunden oder fremde Agentur.';
  END IF;

  -- Berechtigung: für sich selbst immer; für andere nur Admin oder Manager
  IF p_employee_id <> v_caller_id
     AND v_caller_role <> 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND manager_id = v_caller_id)
  THEN
    RAISE EXCEPTION 'Nur für dich selbst oder als Manager/Admin erlaubt.';
  END IF;

  -- Status bestimmen
  v_status := CASE
    WHEN p_type IN ('sick', 'home_office') THEN 'approved'
    ELSE 'requested'
  END;

  INSERT INTO public.absences (
    organization_id, employee_id, type, start_date, end_date, half_day,
    status, reason, decided_at, decided_by
  ) VALUES (
    v_org_id, p_employee_id, p_type, p_start_date, p_end_date,
    COALESCE(p_half_day, 'none'),
    v_status, p_reason,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'approved' THEN v_caller_id ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 7. RPC: Genehmigen / Ablehnen
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.decide_absence(UUID, TEXT, TEXT);

CREATE FUNCTION public.decide_absence(
  p_absence_id UUID,
  p_decision   TEXT,   -- 'approved' | 'rejected'
  p_notes      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_caller_org  UUID;
  v_emp_id      UUID;
  v_abs_status  TEXT;
  v_abs_org     UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Ungültige Entscheidung.';
  END IF;

  SELECT id, role, organization_id INTO v_caller_id, v_caller_role, v_caller_org
  FROM public.employees WHERE user_id = auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT employee_id, status, organization_id INTO v_emp_id, v_abs_status, v_abs_org
  FROM public.absences WHERE id = p_absence_id;

  IF v_emp_id IS NULL OR v_abs_org <> v_caller_org THEN
    RAISE EXCEPTION 'Abwesenheit nicht gefunden.';
  END IF;

  IF v_abs_status <> 'requested' THEN
    RAISE EXCEPTION 'Nur offene Anfragen können entschieden werden.';
  END IF;

  -- Berechtigung: Admin ODER zugewiesener Manager
  IF v_caller_role <> 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = v_emp_id AND manager_id = v_caller_id)
  THEN
    RAISE EXCEPTION 'Nur Manager oder Admin dürfen entscheiden.';
  END IF;

  UPDATE public.absences
  SET status      = p_decision,
      decided_at  = now(),
      decided_by  = v_caller_id,
      notes       = COALESCE(p_notes, notes)
  WHERE id = p_absence_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.decide_absence(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_absence(UUID, TEXT, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 8. RPC: Stornieren
-- ────────────────────────────────────────────────────────────────
-- Vor Startdatum: MA darf selbst stornieren.
-- Nach Startdatum: nur Manager/Admin.

DROP FUNCTION IF EXISTS public.cancel_absence(UUID);

CREATE FUNCTION public.cancel_absence(p_absence_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_caller_org  UUID;
  v_emp_id      UUID;
  v_start       DATE;
  v_status      TEXT;
  v_abs_org     UUID;
  v_is_manager  BOOLEAN;
BEGIN
  SELECT id, role, organization_id INTO v_caller_id, v_caller_role, v_caller_org
  FROM public.employees WHERE user_id = auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT employee_id, start_date, status, organization_id
  INTO v_emp_id, v_start, v_status, v_abs_org
  FROM public.absences WHERE id = p_absence_id;

  IF v_emp_id IS NULL OR v_abs_org <> v_caller_org THEN
    RAISE EXCEPTION 'Abwesenheit nicht gefunden.';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Bereits storniert.';
  END IF;

  v_is_manager :=
    v_caller_role = 'admin'
    OR EXISTS (SELECT 1 FROM public.employees WHERE id = v_emp_id AND manager_id = v_caller_id);

  -- Eigene Stornos: nur wenn vor Startdatum
  IF v_emp_id = v_caller_id THEN
    IF v_start < CURRENT_DATE AND NOT v_is_manager THEN
      RAISE EXCEPTION 'Bereits gestartete Abwesenheit kann nur vom Manager storniert werden.';
    END IF;
  ELSE
    -- Fremde Stornos: nur Manager/Admin
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Nur Manager oder Admin dürfen für andere stornieren.';
    END IF;
  END IF;

  UPDATE public.absences
  SET status = 'cancelled',
      decided_at = now(),
      decided_by = v_caller_id
  WHERE id = p_absence_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.cancel_absence(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_absence(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 9. RPC: Resturlaub berechnen
-- ────────────────────────────────────────────────────────────────
-- Berechnet ROHE Tage. Feiertage werden im Frontend abgezogen,
-- da date-holidays die Logik bereits implementiert.
-- Anteilig bei unterjährigem Start (employees.started_at).

DROP FUNCTION IF EXISTS public.get_vacation_balance(UUID, INTEGER);

CREATE FUNCTION public.get_vacation_balance(
  p_employee_id UUID,
  p_year        INTEGER DEFAULT NULL
)
RETURNS TABLE(
  year                INTEGER,
  yearly_entitlement  INTEGER,   -- pro-rata bei unterjährigem Start
  carryover           INTEGER,
  total_available     INTEGER,
  used_days           NUMERIC,   -- inkl. halbe Tage
  remaining           NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year         INTEGER;
  v_yearly       INTEGER;
  v_carryover    INTEGER;
  v_started      DATE;
  v_pro_rata     INTEGER;
  v_used         NUMERIC;
  v_year_start   DATE;
  v_year_end     DATE;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_year_start := MAKE_DATE(v_year, 1, 1);
  v_year_end   := MAKE_DATE(v_year, 12, 31);

  SELECT vacation_days_per_year, carryover_days, started_at
  INTO v_yearly, v_carryover, v_started
  FROM public.employees WHERE id = p_employee_id;

  IF v_yearly IS NULL THEN
    RAISE EXCEPTION 'Mitarbeiter nicht gefunden.';
  END IF;

  -- Anteilig bei unterjährigem Start (nur im Start-Jahr)
  v_pro_rata := v_yearly;
  IF v_started IS NOT NULL AND EXTRACT(YEAR FROM v_started)::INTEGER = v_year THEN
    -- Verbleibende Monate ab started_at
    v_pro_rata := CEIL(
      v_yearly::NUMERIC *
      (13 - EXTRACT(MONTH FROM v_started)::INTEGER) / 12.0
    )::INTEGER;
  END IF;

  -- Verbrauchte Tage (status approved + type vacation)
  -- Halbe Tage: 0.5, sonst end - start + 1 (jeder Tag voll)
  -- ACHTUNG: Feiertage werden hier NICHT abgezogen (Frontend-Job)
  SELECT COALESCE(SUM(
    CASE
      WHEN half_day <> 'none' THEN 0.5
      ELSE (end_date - start_date + 1)::NUMERIC
    END
  ), 0) INTO v_used
  FROM public.absences
  WHERE employee_id = p_employee_id
    AND type = 'vacation'
    AND status = 'approved'
    AND start_date <= v_year_end
    AND end_date   >= v_year_start;

  RETURN QUERY SELECT
    v_year,
    v_pro_rata,
    COALESCE(v_carryover, 0),
    v_pro_rata + COALESCE(v_carryover, 0),
    v_used,
    (v_pro_rata + COALESCE(v_carryover, 0))::NUMERIC - v_used;
END;
$$;

REVOKE ALL  ON FUNCTION public.get_vacation_balance(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vacation_balance(UUID, INTEGER) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 10. RPC: Anstehende Anfragen für aktuellen User
-- ────────────────────────────────────────────────────────────────
-- Manager sieht Anfragen seiner Direct-Reports. Admins sehen alle.

DROP FUNCTION IF EXISTS public.get_pending_absence_requests();

CREATE FUNCTION public.get_pending_absence_requests()
RETURNS TABLE(
  id              UUID,
  employee_id     UUID,
  employee_name   TEXT,
  employee_email  TEXT,
  type            TEXT,
  start_date      DATE,
  end_date        DATE,
  half_day        TEXT,
  reason          TEXT,
  requested_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_caller_org  UUID;
BEGIN
  SELECT id, role, organization_id INTO v_caller_id, v_caller_role, v_caller_org
  FROM public.employees WHERE user_id = auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.id, e.id, e.name, e.email,
         a.type, a.start_date, a.end_date, a.half_day, a.reason, a.requested_at
  FROM public.absences a
  JOIN public.employees e ON e.id = a.employee_id
  WHERE a.organization_id = v_caller_org
    AND a.status = 'requested'
    AND (
      v_caller_role = 'admin'
      OR e.manager_id = v_caller_id
    )
  ORDER BY a.requested_at ASC;
END;
$$;

REVOKE ALL  ON FUNCTION public.get_pending_absence_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_absence_requests() TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 11. Realtime-Publication
-- ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- Schema-Cache reloaden
-- ────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
