import type { APIRoute } from "astro";
import { codigoSalaValido, normalizarCodigoSala } from "../../../../lib/codigo-sala";
import { criarSupabaseDoUsuario, obterToken, respostaJson } from "../../../../lib/supabase-servidor";

export const GET: APIRoute = async ({ params, request }) => {
  const token = obterToken(request);
  if (!token) return respostaJson({ erro: "Sessão temporária inválida." }, 401);

  const codigo = normalizarCodigoSala(params.codigo ?? "");
  if (!codigoSalaValido(codigo)) return respostaJson({ erro: "Código de sala inválido." }, 400);

  try {
    const supabase = criarSupabaseDoUsuario(token);
    const { data, error } = await supabase.rpc("obter_sala_publica", { p_codigo: codigo });
    if (error) throw error;

    const sala = Array.isArray(data) ? data[0] : data;
    if (!sala) return respostaJson({ erro: "Sala não encontrada ou expirada." }, 404);

    return respostaJson({
      sala: {
        codigo: sala.codigo,
        nome: sala.nome,
        estado: sala.estado,
      },
    });
  } catch (erro) {
    if (erro instanceof Error && erro.message === "SUPABASE_NAO_CONFIGURADO") {
      return respostaJson({ erro: "O Supabase ainda não foi configurado neste ambiente." }, 503);
    }
    return respostaJson({ erro: "Não foi possível consultar a sala agora." }, 500);
  }
};
