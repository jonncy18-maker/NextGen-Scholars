import { createClient } from '@supabase/supabase-js';

// Single source of truth for the project URL + anon key. Components that call
// Edge Functions via fetch import SUPABASE_URL from here rather than hardcoding it.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
