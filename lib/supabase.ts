import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iuyyvpotkgsuuipyfisw.supabase.co';
const supabaseKey = 'sb_publishable_fuA6GKV-KGXVbsaVSwv17w_xiWA2W2A';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
