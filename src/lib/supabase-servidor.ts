import { createClient } from "@supabase/supabase-js";

export function obterToken(request: Request): string | null {
  const cabecalho = request.headers.get("Authorization");
  if (!cabecalho?.startsWith("Bearer ")) return null;
  return cabecalho.slice(7).trim() || null;
}

export function criarSupabaseDoUsuario(token: string) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const chave = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !chave) {
    throw new Error("SUPABASE_NAO_CONFIGURADO");
  }

  return createClient(url, chave, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function mensagemErroSupabase(mensagem: string): string {
  if (mensagem.includes("sala_nao_encontrada")) return "Sala não encontrada ou expirada.";
  if (mensagem.includes("participante_removido")) return "Esta sessão foi removida da sala.";
  if (mensagem.includes("participante_nao_encontrado")) return "Participante não encontrado na sala.";
  if (mensagem.includes("limite_sala")) return "A sala atingiu o limite de participantes.";
  if (mensagem.includes("nome_invalido")) return "Informe um nome válido.";
  if (mensagem.includes("votacao_encerrada")) return "A votação já foi revelada.";
  if (mensagem.includes("carta_invalida")) return "Esta carta não pertence ao conjunto da sala.";
  if (mensagem.includes("sem_permissao")) return "Você não tem permissão para realizar esta ação.";
  return "Não foi possível concluir a operação no momento.";
}
