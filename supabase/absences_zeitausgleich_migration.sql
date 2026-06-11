-- ================================================================
-- AGENTUR OS — Abwesenheiten v2
-- Neue Typen: Zeitausgleich + Unbezahlter Urlaub
-- Exakte Uhrzeiten für Teil-Tage (start_time / end_time)
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. type-CHECK erweitern: zeitausgleich + unpaid_vacation
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.absences DROP CONSTRAINT IF EXISTS absences_type_check;
ALTER TABLE public.absences
  ADD CONSTRAINT absences_type_check
  CHECK (type IN ('vacation', 'unpaid_vacation', 'zeitausgleich', 'sick', 'home_office', 'other'));

-- ────────────────────────────────────────────────────────────────
-- 2. Exakte Uhrzeiten für Teil-Tage
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'absences_times_single_day') THEN
    ALTER TABLE public.absences
      ADD CONSTRAINT absences_times_single_day
      CHECK (start_time IS NULL OR start_date = end_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'absences_times_order') THEN
    ALTER TABLE public.absences
      ADD CONSTRAINT absences_times_order
      CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 3. RPC: request_absence — jetzt mit Uhrzeiten
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TIME, TIME, TEXT);

CREATE FUNCTION public.request_absence(
  p_employee_id UUID,
  p_type        TEXT,
  p_start_date  DATE,
  p_end_date    DATE,
  p_half_day    TEXT DEFAULT 'none',
  p_start_time  TIME DEFAULT NULL,
  p_end_time    TIME DEFAULT NULL,
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
  SELECT id, role, organization_id INTO v_caller_id, v_caller_role, v_org_id
  FROM public.employees WHERE user_id = auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Nicht autorisiert.';
  END IF;

  SELECT organization_id INTO v_emp_org
  FROM public.employees WHERE id = p_employee_id;

  IF v_emp_org IS NULL OR v_emp_org <> v_org_id THEN
    RAISE EXCEPTION 'Mitarbeiter nicht gefunden oder fremde Agentur.';
  END IF;

  IF p_employee_id <> v_caller_id
     AND v_caller_role <> 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND manager_id = v_caller_id)
  THEN
    RAISE EXCEPTION 'Nur für dich selbst oder als Manager/Admin erlaubt.';
  END IF;

  -- Krank/Homeoffice direkt aktiv, alles andere (inkl. Zeitausgleich,
  -- unbezahlter Urlaub) braucht Freigabe.
  v_status := CASE
    WHEN p_type IN ('sick', 'home_office') THEN 'approved'
    ELSE 'requested'
  END;

  INSERT INTO public.absences (
    organization_id, employee_id, type, start_date, end_date, half_day,
    start_time, end_time, status, reason, decided_at, decided_by
  ) VALUES (
    v_org_id, p_employee_id, p_type, p_start_date, p_end_date,
    COALESCE(p_half_day, 'none'),
    p_start_time, p_end_time,
    v_status, p_reason,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'approved' THEN v_caller_id ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TIME, TIME, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_absence(UUID, TEXT, DATE, DATE, TEXT, TIME, TIME, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. RPC: Resturlaub — Teil-Tage mit Uhrzeit anteilig (8h-Referenz)
--    Unbezahlter Urlaub zählt NICHT gegen den bezahlten Anspruch.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_vacation_balance(UUID, INTEGER);

CREATE FUNCTION public.get_vacation_balance(
  p_employee_id UUID,
  p_year        INTEGER DEFAULT NULL
)
RETURNS TABLE(
  year                INTEGER,
  yearly_entitlement  INTEGER,
  carryover           INTEGER,
  total_available     INTEGER,
  used_days           NUMERIC,
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

  v_pro_rata := v_yearly;
  IF v_started IS NOT NULL AND EXTRACT(YEAR FROM v_started)::INTEGER = v_year THEN
    v_pro_rata := CEIL(
      v_yearly::NUMERIC *
      (13 - EXTRACT(MONTH FROM v_started)::INTEGER) / 12.0
    )::INTEGER;
  END IF;

  -- Verbrauchte Tage (status approved + type vacation)
  --   - exakte Uhrzeit (Einzeltag): Stunden / 8 (max. 1)
  --   - Halbtag: 0.5
  --   - sonst: jeder Tag voll (Feiertags-Abzug macht das Frontend)
  SELECT COALESCE(SUM(
    CASE
      WHEN start_time IS NOT NULL AND end_time IS NOT NULL AND start_date = end_date
        THEN LEAST(1.0, GREATEST(0.0, EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0 / 8.0))
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
-- 5. RPC: Offene Anfragen — jetzt inkl. Uhrzeiten
-- ────────────────────────────────────────────────────────────────
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
  start_time      TIME,
  end_time        TIME,
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
         a.type, a.start_date, a.end_date, a.half_day, a.start_time, a.end_time, a.reason, a.requested_at
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
NOTIFY pgrst, 'reload schema';
