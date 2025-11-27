import { createClient } from '@supabase/supabase-js';

// HIER DEINE DATEN EINFÜGEN:
const supabaseUrl = 'https://lkyqohkdxmchrjicvurn.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreXFvaGtkeG1jaHJqaWN2dXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjYyMTUsImV4cCI6MjA3OTc0MjIxNX0.9MxfYRGbFWZyCI-u-zoWOhW9bIJofFWQ9XPfIUde-Ys';

export const supabase = createClient(supabaseUrl, supabaseKey);
