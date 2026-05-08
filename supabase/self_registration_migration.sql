-- ================================================================
-- AGENTUR OS — Selbst-Registrierung für neue Agenturen
-- Im Supabase SQL Editor ausführen
-- ================================================================
-- Erstellt eine neue Organisation + Admin-Mitarbeiter in einer
-- einzigen gesicherten Transaktion, die RLS umgeht.
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_new_organization(
  p_org_name    TEXT,
  p_employee_name TEXT,
  p_job_title   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      UUID;
  v_initials    TEXT;
  v_parts       TEXT[];
BEGIN
  -- Schutz: User darf noch keiner Organisation angehören
  IF EXISTS (
    SELECT 1 FROM public.employees WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Dieser Account gehört bereits einer Organisation an.';
  END IF;

  -- Initialen aus Name generieren (max. 2 Buchstaben)
  v_parts := STRING_TO_ARRAY(TRIM(p_employee_name), ' ');
  v_initials := UPPER(
    CASE
      WHEN ARRAY_LENGTH(v_parts, 1) >= 2
        THEN LEFT(v_parts[1], 1) || LEFT(v_parts[2], 1)
      ELSE LEFT(v_parts[1], 2)
    END
  );

  -- 1. Organisation anlegen
  INSERT INTO public.organizations (name)
  VALUES (TRIM(p_org_name))
  RETURNING id INTO v_org_id;

  -- 2. Agentur-Einstellungen mit Standardwerten anlegen
  INSERT INTO public.agency_settings (
    organization_id, company_name,
    address, tax_id, bank_name, iban, bic,
    commercial_register, footer_text, logo_url
  ) VALUES (
    v_org_id, TRIM(p_org_name),
    '', '', '', '', '', '', '', ''
  );

  -- 3. Admin-Mitarbeiter anlegen und mit Auth-Account verknüpfen
  INSERT INTO public.employees (
    name, email, initials,
    organization_id, user_id,
    role, job_title
  ) VALUES (
    TRIM(p_employee_name),
    auth.email(),
    v_initials,
    v_org_id,
    auth.uid(),
    'admin',
    p_job_title
  );

  RETURN v_org_id;
END;
$$;

-- Zugriff: Nur authentifizierte User dürfen die Funktion aufrufen
REVOKE ALL ON FUNCTION public.create_new_organization(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_new_organization(TEXT, TEXT, TEXT) TO authenticated;
