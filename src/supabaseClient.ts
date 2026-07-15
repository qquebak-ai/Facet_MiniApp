import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "ВАШ_PROJECT_URL";
const supabaseAnonKey = "ВАШ_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
