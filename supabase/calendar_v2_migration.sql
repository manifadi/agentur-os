-- Calendar v2 Migration: Bidirectional Sync, Visibility, Meeting URLs, Hidden Events
-- Run this in the Supabase SQL Editor

-- 1. calendar_events: add new fields
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS source_external_id TEXT,
  ADD COLUMN IF NOT EXISTS target_calendar_id UUID;

-- 2. external_calendars: add provider type + OAuth fields
ALTER TABLE external_calendars
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'ical' CHECK (provider_type IN ('ical', 'google', 'outlook', 'apple', 'troi', 'teams')),
  ADD COLUMN IF NOT EXISTS is_writable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS external_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS oauth_access_token TEXT,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS oauth_expires_at TIMESTAMPTZ;

-- 3. hidden_calendar_events: per-user event hiding (for duplicates and clutter)
CREATE TABLE IF NOT EXISTS hidden_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  external_event_uid TEXT,
  external_calendar_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hidden_calendar_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hidden_calendar_events'
    AND policyname = 'hidden_events_org_isolation'
  ) THEN
    CREATE POLICY hidden_events_org_isolation ON hidden_calendar_events
      USING (organization_id = get_my_organization_id())
      WITH CHECK (organization_id = get_my_organization_id());
  END IF;
END $$;

-- 4. Set up required env vars in your .env.local:
--    GOOGLE_CLIENT_ID=...         (from Google Cloud Console)
--    GOOGLE_CLIENT_SECRET=...     (from Google Cloud Console)
--    MICROSOFT_CLIENT_ID=...      (from Azure Portal)
--    MICROSOFT_CLIENT_SECRET=...  (from Azure Portal)
--    NEXT_PUBLIC_APP_URL=https://your-domain.com
