import { createClient } from "@supabase/supabase-js";


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase configuration is incomplete. Please update the fallback values in src/config/supabaseClient.js or set up environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);