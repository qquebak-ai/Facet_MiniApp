import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rinxzaakkhxdbhjghtwa.supabase.co";
const supabaseAnonKey = "sb_publishable_wtYIk727NN5RA4Io7p2WAw_3xWWj9v6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
