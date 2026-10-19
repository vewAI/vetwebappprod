import {createClient} from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fbqgvasmojoczpmeulqv.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicWd2YXNtb2pvY3pwbWV1bHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MzQ1NzksImV4cCI6MjA2ODQxMDU3OX0.gdch4tkFVRBHRnAT8WHLHIbFtDsOV9Fk2Je0GvqjhXk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);