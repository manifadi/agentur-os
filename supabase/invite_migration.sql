-- ================================================================
-- AGENTUR OS — Einladungssystem
-- Im Supabase SQL Editor ausführen
-- ================================================================

-- Hilfsfunktion: Verknüpft einen eingeladenen User mit seinem Employee-Record
-- Wird vom Frontend aufgerufen wenn ein eingeladener User sich zum ersten Mal einloggt.
-- SECURITY DEFINER: umgeht RLS, damit der User seinen eigenen Eintrag finden kann,
-- auch bevor user_id gesetzt ist.

CREATE OR REPLACE FUNCTION public.link_invited_employee()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.employees
  SET user_id = auth.uid()
  WHERE lower(email) = lower(auth.email())
    AND user_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;
