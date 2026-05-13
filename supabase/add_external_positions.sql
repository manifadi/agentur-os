-- Adds Fremdleistung support to project_positions.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.project_positions
ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0;
