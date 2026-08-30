import type { APIRoute } from "astro";
import { conjuntoCartasValido } from "../../../lib/cartas";
import { criarSupabaseDoUsuario, obterToken, respostaJson } from "../../../lib/supabase-servidor";

export const POST: APIRoute = async ({ request }) => {
  const token = obterToken(request);
  if (!token) return respostaJson({ erro: "Sessão temporária inválida." }, 401);

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const nomeCriador = typeof corpo?.nomeCriador === "string" ? corpo.nomeCriador.trim() : "";
  const nomeSala = typeof corpo?.nomeSala === "string" ? corpo.nomeSala.trim() : "";
  const conjuntoCartas = typeof corpo?.conjuntoCartas === "string" ? corpo.conjuntoCartas : "";

  if (nomeCriador.length < 1 || nomeCriador.length > 40) {
    return respostaJson({ erro: "Informe seu nome com até 40 caracteres." }, 400);
  }
  if (nomeSala.length < 1 || nomeSala.length > 80) {
    return respostaJson({ erro: "Informe o nome da sala com até 80 caracteres." }, 400);
  }
  if (!conjuntoCartasValido(conjuntoCartas)) {
    return respostaJson({ erro: "Escolha um conjunto de cartas válido." }, 400);
  }

  try {
    const supabase = criarSupabaseDoUsuario(token);
    const { data, error } = await supabase.rpc("criar_sala", {
      p_nome_criador: nomeCriador,
      p_nome_sala: nomeSala,
      p_conjunto_cartas: conjuntoCartas,
    });

    if (error) throw error;
    const sala = Array.isArray(data) ? data[0] : data;
    if (!sala?.codigo) throw new Error("resposta_invalida");

    return respostaJson({ codigo: sala.codigo });
  } catch (erro) {
    if (erro instanceof Error && erro.message === "SUPABASE_NAO_CONFIGURADO") {
      return respostaJson({ erro: "O Supabase ainda não foi configurado neste ambiente." }, 503);
    }
    return respostaJson({ erro: "Não foi possível criar a sala agora." }, 500);
  }
};
