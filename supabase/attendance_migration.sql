-- ================================================================
-- AGENTUR OS — Stempeluhr / Anwesenheitszeit (attendance_entries)
-- Im Supabase SQL Editor ausführen (idempotent)
-- ================================================================
-- Features:
--   - Ein-/Ausstempeln ("ich bin jetzt da") — getrennt von der
--     projektbezogenen Zeiterfassung (time_entries).
--   - Mehrere Sessions pro Tag (Mittagspause = ausstempeln + später
--     wieder einstempeln). Tagessumme = Summe aller Sessions.
--   - Nur EINE offene Session pro Mitarbeiter (Partial-Unique-Index).
--   - Korrektur/Nachtrag im Frontend (direkte Insert/Update, RLS-geschützt).
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. Tabelle: attendance_entries
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  clock_in        TIMESTAMPTZ NOT NULL,
  clock_out       TIMESTAMPTZ,              -- NULL = laufende Session
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (clock_out IS NULL OR clock_out >= clock_in)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_clockin
  ON public.attendance_entries (employee_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_org_clockin
  ON public.attendance_entries (organization_id, clock_in);

-- Nur eine offene Session (clock_out IS NULL) pro Mitarbeiter zulassen.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_one_open_session
  ON public.attendance_entries (employee_id)
  WHERE clock_out IS NULL;


-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_attendance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_touch_updated_at ON public.attendance_entries;
CREATE TRIGGER trg_attendance_touch_updated_at
  BEFORE UPDATE ON public.attendance_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_updated_at();


-- ────────────────────────────────────────────────────────────────
-- 2. RLS — Org-Isolation + Super-Admin Read
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_org_isolation" ON public.attendance_entries;
CREATE POLICY "attendance_org_isolation" ON public.attendance_entries
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

DROP POLICY IF EXISTS "attendance_super_admin_read" ON public.attendance_entries;
CREATE POLICY "attendance_super_admin_read" ON public.attendance_entries
  FOR SELECT USING (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 3. Realtime-Publication
-- ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_entries;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- 4. PostgREST Schema-Cache neu laden
-- ────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
