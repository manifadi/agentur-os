-- Calendar Encryption & Sync-State Migration
-- Run this in the Supabase SQL Editor.
--
-- Adds:
--   1. last_synced_at column — tracks when each calendar was last successfully fetched
--   2. Documentation only: existing oauth_access_token column now stores
--      AES-256-GCM encrypted values (prefixed with `enc:v1:`) when
--      CALENDAR_ENCRYPTION_KEY is set in .env.local. Legacy plaintext values
--      are gracefully decrypted (safeDecrypt fallback in app/utils/crypto.ts),
--      so no data migration is needed.

ALTER TABLE external_calendars
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Generate a new encryption key (run this on your machine, NOT in the DB):
--   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
--
-- Then add to .env.local:
--   CALENDAR_ENCRYPTION_KEY=<the-base64-output>
--
-- Once the key is set, all NEW tokens/passwords stored by Vela will be
-- encrypted. Existing plaintext rows are read as-is until they get re-saved
-- (e.g. on token refresh).
