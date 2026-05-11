-- Adds allocation_status column to resource_allocations.
-- This is an allocation-specific status independent from the overall project status.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.resource_allocations
ADD COLUMN IF NOT EXISTS allocation_status text DEFAULT 'Geplant';
