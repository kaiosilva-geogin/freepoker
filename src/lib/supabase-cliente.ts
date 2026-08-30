import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let instancia: SupabaseClient | null = null;

export function supabaseConfigurado(): boolean {
  return Boolean(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function obterSupabase(): SupabaseClient {
  if (instancia) return instancia;

  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const chave = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !chave) {
    throw new Error("O Supabase ainda não foi configurado neste ambiente.");
  }

  instancia = createClient(url, chave, {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return instancia;
}

export async function garantirSessaoAnonima() {
  const supabase = obterSupabase();
  const { data: sessaoAtual } = await supabase.auth.getSession();
  if (sessaoAtual.session) return sessaoAtual.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(error?.message || "Não foi possível iniciar a sessão temporária.");
  }

  return data.session;
}
