-- Add project_links JSONB column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_links JSONB DEFAULT '[]'::jsonb;
