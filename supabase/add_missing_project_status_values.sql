-- Adds the two status values that exist in the frontend but are missing from the DB enum.
-- Run this once in the Supabase SQL editor.

ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'Priorisierung';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'Geplant';
