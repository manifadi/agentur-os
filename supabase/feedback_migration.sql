-- ================================================================
-- AGENTUR OS — User-Feedback / Bug-Report
-- Im Supabase SQL Editor ausführen
-- ================================================================
-- Idempotent: kann mehrfach ausgeführt werden.
--
-- Was diese Migration macht:
--   1. Tabelle user_feedback (tenant-scoped, mit organization_id)
--   2. RLS: Org-Mitglieder dürfen eigene Org lesen + einfügen,
--      Super-Admin liest/schreibt global
--   3. updated_at-Trigger
--   4. RPCs (alle mit Audit-Logging):
--        - get_all_feedback_super_admin()  → Liste inkl. Org-/Reporter-Namen
--        - set_feedback_status(...)        → Status + Admin-Notiz setzen
--        - delete_feedback_super_admin(...)
--   5. Storage-Bucket 'feedback' (public) + Upload-Policy
--   6. Realtime-Publication
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. Tabelle
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES public.employees(id) ON DELETE SET NULL,

  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('bug', 'wish', 'other')),
  title           TEXT,
  message         TEXT NOT NULL,
  page_url        TEXT,
  image_url       TEXT,

  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'in_progress', 'done', 'dismissed')),
  admin_notes     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_org_status
  ON public.user_feedback (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at
  ON public.user_feedback (created_at DESC);


-- ────────────────────────────────────────────────────────────────
-- 2. updated_at-Trigger
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_user_feedback_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_feedback_touch_updated_at ON public.user_feedback;
CREATE TRIGGER trg_user_feedback_touch_updated_at
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_feedback_updated_at();


-- ────────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Lesen: eigene Org ODER Super-Admin (global)
DROP POLICY IF EXISTS "user_feedback_read" ON public.user_feedback;
CREATE POLICY "user_feedback_read" ON public.user_feedback
  FOR SELECT
  USING (
    organization_id = get_my_organization_id()
    OR is_super_admin()
  );

-- Einfügen: nur in die eigene Org
DROP POLICY IF EXISTS "user_feedback_insert" ON public.user_feedback;
CREATE POLICY "user_feedback_insert" ON public.user_feedback
  FOR INSERT
  WITH CHECK (organization_id = get_my_organization_id());

-- Schreiben/Löschen (Status, Notizen): nur Super-Admin
DROP POLICY IF EXISTS "user_feedback_super_admin_write" ON public.user_feedback;
CREATE POLICY "user_feedback_super_admin_write" ON public.user_feedback
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 4. RPC: Alle Reports für Super-Admin (inkl. Org- + Reporter-Namen)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_all_feedback_super_admin()
RETURNS TABLE(
  id              UUID,
  organization_id UUID,
  org_name        TEXT,
  employee_id     UUID,
  reporter_name   TEXT,
  reporter_email  TEXT,
  category        TEXT,
  title           TEXT,
  message         TEXT,
  page_url        TEXT,
  image_url       TEXT,
  status          TEXT,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
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
    f.id, f.organization_id, o.name,
    f.employee_id, e.name, e.email,
    f.category, f.title, f.message, f.page_url, f.image_url,
    f.status, f.admin_notes, f.created_at, f.updated_at
  FROM public.user_feedback f
  LEFT JOIN public.organizations o ON o.id = f.organization_id
  LEFT JOIN public.employees     e ON e.id = f.employee_id
  ORDER BY f.created_at DESC;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 5. RPC: Status + Admin-Notiz setzen
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_feedback_status(
  p_feedback_id UUID,
  p_status      TEXT,
  p_admin_notes TEXT DEFAULT NULL
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

  IF p_status NOT IN ('new', 'in_progress', 'done', 'dismissed') THEN
    RAISE EXCEPTION 'Ungültiger Status: %', p_status;
  END IF;

  UPDATE public.user_feedback SET
    status      = p_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes)
  WHERE id = p_feedback_id;

  PERFORM log_super_admin_action(
    'feedback.status',
    'feedback', p_feedback_id::TEXT,
    jsonb_build_object('status', p_status)
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 6. RPC: Report löschen
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_feedback_super_admin(
  p_feedback_id UUID
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

  DELETE FROM public.user_feedback WHERE id = p_feedback_id;

  PERFORM log_super_admin_action(
    'feedback.delete',
    'feedback', p_feedback_id::TEXT,
    NULL
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 7. Grants
-- ────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_all_feedback_super_admin   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_feedback_status            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_feedback_super_admin    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_all_feedback_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_feedback_status          TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_feedback_super_admin  TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 8. Storage-Bucket 'feedback' (public) + Upload-Policy
-- ────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback', 'feedback', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Eingeloggte Nutzer dürfen Screenshots hochladen
DROP POLICY IF EXISTS "feedback_bucket_upload" ON storage.objects;
CREATE POLICY "feedback_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback');

-- Lesen (Bucket ist public, Policy für API-Konsistenz)
DROP POLICY IF EXISTS "feedback_bucket_read" ON storage.objects;
CREATE POLICY "feedback_bucket_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feedback');


-- ────────────────────────────────────────────────────────────────
-- 9. Realtime-Publication
-- ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_feedback'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_feedback;
  END IF;
END $$;


NOTIFY pgrst, 'reload schema';
