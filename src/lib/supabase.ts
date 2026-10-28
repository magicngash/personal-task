import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const validUrl = typeof url === 'string' && /^https?:\/\//i.test(url);

export const supabase = validUrl && key ? createClient(url, key) : null;
