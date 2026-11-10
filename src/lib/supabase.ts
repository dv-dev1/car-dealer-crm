import { createClient } from "@supabase/supabase-js";

// Cliente Supabase pro browser (leitura pública de veículos).
// Fica inerte enquanto as env vars não estão preenchidas — o site
// roda no mock local até lá (ver src/lib/veiculos.ts).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
