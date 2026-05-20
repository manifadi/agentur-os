-- Realtime Publication Migration
-- Stellt sicher, dass alle live-relevanten Tabellen via Supabase Realtime gestreamt werden.
-- Voraussetzung für useRealtimeTable-Hook + CalendarDataProvider.
--
-- Run in Supabase SQL Editor.

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        -- Kalender
        'calendar_events',
        'external_calendars',
        'hidden_calendar_events',
        -- ClientAppShell (Live-Updates über die ganze App)
        'clients',
        'employees',
        'departments',
        'projects',
        'todos',
        'project_positions',
        'project_members',
        'resource_allocations',
        'time_entries',
        'agency_settings'
    ];
BEGIN
    -- Publication erstellen falls nicht vorhanden
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Jede Tabelle einzeln hinzufügen (idempotent — Fehler bei Duplikaten ignorieren)
    FOREACH tbl IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
            RAISE NOTICE 'Added % to supabase_realtime', tbl;
        EXCEPTION
            WHEN duplicate_object THEN
                RAISE NOTICE 'Already in publication: %', tbl;
            WHEN undefined_table THEN
                RAISE WARNING 'Table % does not exist — skipping', tbl;
        END;
    END LOOP;
END $$;

-- REPLICA IDENTITY auf FULL setzen, damit DELETE-Payloads alle Spalten enthalten
-- (sonst kommt nur die id im old-row und client-side Filter funktionieren nicht zuverlässig)
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'calendar_events',
        'external_calendars',
        'hidden_calendar_events',
        'todos',
        'project_positions',
        'project_members',
        'resource_allocations',
        'time_entries'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', tbl);
        EXCEPTION
            WHEN undefined_table THEN
                RAISE WARNING 'Table % does not exist — skipping REPLICA IDENTITY', tbl;
        END;
    END LOOP;
END $$;

-- Verify
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
