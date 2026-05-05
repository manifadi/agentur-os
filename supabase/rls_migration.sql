-- ================================================================
-- AGENTUR OS — Datenbank-Sicherheit: Row-Level Security (RLS)
-- ================================================================
-- Im Supabase SQL Editor ausführen (Database → SQL Editor)
-- Sicher: Keine bestehenden Daten werden gelöscht oder verändert.
-- Skript ist idempotent — kann mehrfach ausgeführt werden.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- SCHRITT 1: user_id Spalte in employees hinzufügen
-- ────────────────────────────────────────────────────────────────
-- Verknüpft jeden Mitarbeiter über eine UUID mit seinem Auth-Account.
-- Nötig damit RLS-Policies auth.uid() nutzen können (statt E-Mail).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Vorhandene Einträge automatisch verknüpfen (E-Mail-Abgleich mit auth.users)
UPDATE public.employees e
SET user_id = u.id
FROM auth.users u
WHERE lower(e.email) = lower(u.email)
  AND e.user_id IS NULL;

-- Unique Constraint: 1 Auth-User = 1 Employee-Datensatz
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_user_id_unique;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_user_id_unique UNIQUE (user_id);

-- ⚠ WICHTIG: Mitarbeiter OHNE verknüpften Auth-Account prüfen!
-- Diese können sich nach RLS-Aktivierung nicht mehr einloggen.
-- Vor dem nächsten Schritt sicherstellen, dass diese Liste leer ist.
SELECT id, name, email, 'KEIN AUTH-ACCOUNT — BITTE PRÜFEN' AS warnung
FROM public.employees
WHERE user_id IS NULL;


-- ────────────────────────────────────────────────────────────────
-- SCHRITT 2: Helper-Funktion (läuft als postgres, bypassed RLS)
-- ────────────────────────────────────────────────────────────────
-- Gibt die organization_id des aktuell eingeloggten Users zurück.
-- SECURITY DEFINER verhindert eine Endlosrekursion mit der employees-Policy.

CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.employees
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


-- ────────────────────────────────────────────────────────────────
-- SCHRITT 3: RLS auf allen Tabellen aktivieren
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_positions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_allocations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_calendars      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests   ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────
-- SCHRITT 4: Alte Policies entfernen (für sicheres Wiederausführen)
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "organizations_own_only"                ON public.organizations;
DROP POLICY IF EXISTS "employees_org_isolation"               ON public.employees;
DROP POLICY IF EXISTS "departments_org_isolation"             ON public.departments;
DROP POLICY IF EXISTS "clients_org_isolation"                 ON public.clients;
DROP POLICY IF EXISTS "client_contacts_org_isolation"         ON public.client_contacts;
DROP POLICY IF EXISTS "client_logs_org_isolation"             ON public.client_logs;
DROP POLICY IF EXISTS "projects_org_isolation"                ON public.projects;
DROP POLICY IF EXISTS "todos_org_isolation"                   ON public.todos;
DROP POLICY IF EXISTS "project_logs_org_isolation"            ON public.project_logs;
DROP POLICY IF EXISTS "project_sections_org_isolation"        ON public.project_sections;
DROP POLICY IF EXISTS "project_positions_org_isolation"       ON public.project_positions;
DROP POLICY IF EXISTS "project_members_org_isolation"         ON public.project_members;
DROP POLICY IF EXISTS "project_invoices_org_isolation"        ON public.project_invoices;
DROP POLICY IF EXISTS "resource_allocations_org_isolation"    ON public.resource_allocations;
DROP POLICY IF EXISTS "agency_positions_org_isolation"        ON public.agency_positions;
DROP POLICY IF EXISTS "agency_settings_org_isolation"         ON public.agency_settings;
DROP POLICY IF EXISTS "organization_templates_org_isolation"  ON public.organization_templates;
DROP POLICY IF EXISTS "calendar_events_org_isolation"         ON public.calendar_events;
DROP POLICY IF EXISTS "external_calendars_org_isolation"      ON public.external_calendars;
DROP POLICY IF EXISTS "time_entries_org_isolation"            ON public.time_entries;
DROP POLICY IF EXISTS "registration_requests_public_insert"   ON public.registration_requests;


-- ────────────────────────────────────────────────────────────────
-- SCHRITT 5: RLS Policies erstellen
-- ────────────────────────────────────────────────────────────────
-- Alle Policies folgen dem gleichen Prinzip:
--   USING       → Welche Zeilen darf der User lesen / ändern / löschen?
--   WITH CHECK  → Welche Zeilen darf der User einfügen / aktualisieren?
-- Tabellen MIT direkter organization_id Spalte:

CREATE POLICY "organizations_own_only" ON public.organizations
  FOR ALL
  USING     (id = get_my_organization_id())
  WITH CHECK(id = get_my_organization_id());

CREATE POLICY "employees_org_isolation" ON public.employees
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "departments_org_isolation" ON public.departments
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "clients_org_isolation" ON public.clients
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "client_contacts_org_isolation" ON public.client_contacts
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "client_logs_org_isolation" ON public.client_logs
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "projects_org_isolation" ON public.projects
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "todos_org_isolation" ON public.todos
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "project_logs_org_isolation" ON public.project_logs
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "project_invoices_org_isolation" ON public.project_invoices
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "resource_allocations_org_isolation" ON public.resource_allocations
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "agency_positions_org_isolation" ON public.agency_positions
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "agency_settings_org_isolation" ON public.agency_settings
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "organization_templates_org_isolation" ON public.organization_templates
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "calendar_events_org_isolation" ON public.calendar_events
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

CREATE POLICY "external_calendars_org_isolation" ON public.external_calendars
  FOR ALL
  USING     (organization_id = get_my_organization_id())
  WITH CHECK(organization_id = get_my_organization_id());

-- ────────────────────────────────────────────────────────────────
-- Tabellen OHNE direkte organization_id — Zugriff via Parent
-- ────────────────────────────────────────────────────────────────

-- project_sections → Zugriff nur wenn Eltern-Projekt zur eigenen Org gehört
CREATE POLICY "project_sections_org_isolation" ON public.project_sections
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id = get_my_organization_id()
    )
  );

-- project_positions → Zugriff nur wenn Eltern-Projekt zur eigenen Org gehört
CREATE POLICY "project_positions_org_isolation" ON public.project_positions
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id = get_my_organization_id()
    )
  );

-- project_members → Zugriff nur wenn Eltern-Projekt zur eigenen Org gehört
CREATE POLICY "project_members_org_isolation" ON public.project_members
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id = get_my_organization_id()
    )
  );

-- time_entries → Zugriff nur wenn der Mitarbeiter zur eigenen Org gehört
CREATE POLICY "time_entries_org_isolation" ON public.time_entries
  FOR ALL
  USING (
    employee_id IN (
      SELECT id FROM public.employees
      WHERE organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees
      WHERE organization_id = get_my_organization_id()
    )
  );

-- ────────────────────────────────────────────────────────────────
-- registration_requests: Jeder darf eine Anfrage stellen (INSERT)
-- Lesen / Aktualisieren nur über SECURITY DEFINER RPCs (Super Admin)
-- ────────────────────────────────────────────────────────────────
CREATE POLICY "registration_requests_public_insert" ON public.registration_requests
  FOR INSERT WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────
-- SCHRITT 6: Storage Bucket Policies (client-logos)
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_logos_read"   ON storage.objects;
DROP POLICY IF EXISTS "client_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "client_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "client_logos_delete" ON storage.objects;

CREATE POLICY "client_logos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "client_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-logos');

CREATE POLICY "client_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "client_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos');


-- ================================================================
-- VERIFIKATION — Nach dem Ausführen prüfen
-- ================================================================

-- 1) RLS-Status aller Tabellen (alle müssen "RLS AKTIV" zeigen)
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'RLS AKTIV' ELSE '!! KEIN RLS !!' END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations','employees','departments','clients','client_contacts',
    'client_logs','projects','todos','project_logs','project_sections',
    'project_positions','project_members','project_invoices',
    'resource_allocations','agency_positions','agency_settings',
    'organization_templates','calendar_events','external_calendars',
    'time_entries','registration_requests'
  )
ORDER BY tablename;

-- 2) Alle aktiven Policies anzeigen (21 Policies erwartet)
SELECT
  tablename,
  policyname,
  cmd AS operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Employees ohne Auth-Account (sollte leer sein!)
SELECT id, name, email
FROM public.employees
WHERE user_id IS NULL;
