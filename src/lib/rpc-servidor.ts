import { criarSupabaseDoUsuario, mensagemErroSupabase, obterToken, respostaJson } from "./supabase-servidor";

export async function executarRpc(
  request: Request,
  nome: string,
  parametros: Record<string, unknown>,
): Promise<{ data?: unknown; response?: Response }> {
  const token = obterToken(request);
  if (!token) return { response: respostaJson({ erro: "Sessão temporária inválida." }, 401) };

  try {
    const supabase = criarSupabaseDoUsuario(token);
    const { data, error } = await supabase.rpc(nome, parametros);
    if (error) {
      const mensagem = error.message || error.code || "erro_supabase";
      const status = mensagem.includes("sem_permissao") ? 403 : mensagem.includes("nao_encontrad") ? 404 : 400;
      return { response: respostaJson({ erro: mensagemErroSupabase(mensagem) }, status) };
    }
    return { data };
  } catch (erro) {
    if (erro instanceof Error && erro.message === "SUPABASE_NAO_CONFIGURADO") {
      return { response: respostaJson({ erro: "O Supabase ainda não foi configurado neste ambiente." }, 503) };
    }
    return { response: respostaJson({ erro: "Não foi possível concluir a operação agora." }, 500) };
  }
}
