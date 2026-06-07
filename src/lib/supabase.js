import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://rhoxpfuephkuaartuqou.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJob3hwZnVlcGhrdWFhcnR1cW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTE5MjIsImV4cCI6MjA5NjM2NzkyMn0.y6QakqWxP3t-FPH6qx408EAOR0cnFByf0FktGyYffs0'
);
