-- Calendar CalDAV Migration: Add username field for CalDAV connections
-- Run in Supabase SQL Editor

ALTER TABLE external_calendars
  ADD COLUMN IF NOT EXISTS caldav_username TEXT;

-- Note: CalDAV connections use these fields:
--   url               = full CalDAV calendar URL (e.g. https://app.troi.software/remote.php/dav/calendars/user/default/)
--   caldav_username   = CalDAV username (usually email address)
--   oauth_access_token= CalDAV password (reused field, stored as-is)
--   provider_type     = 'troi' | 'apple' | 'ical' (any CalDAV server)
--   is_writable       = false (read-only CalDAV for now)
