-- Calendar Account Label Migration
-- Run in Supabase SQL Editor.
--
-- Adds account_label column to group multiple calendars from the same OAuth
-- account (e.g. one Google account often has primary, work, family, holidays
-- calendars). Used by the sidebar to render collapsible account groups.

ALTER TABLE external_calendars
  ADD COLUMN IF NOT EXISTS account_label TEXT;

-- For existing rows: backfill from caldav_username (for CalDAV) or
-- external_calendar_id where it looks like an email (for legacy Microsoft/Google).
UPDATE external_calendars
SET account_label = caldav_username
WHERE account_label IS NULL AND caldav_username IS NOT NULL;
