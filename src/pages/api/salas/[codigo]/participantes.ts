import type { APIRoute } from "astro";
import { normalizarCodigoSala } from "../../../../lib/codigo-sala";
import { executarRpc } from "../../../../lib/rpc-servidor";
import { respostaJson } from "../../../../lib/supabase-servidor";

export const POST: APIRoute = async ({ params, request }) => {
  const corpo = (await request.json().catch(() => null)) as { nome?: unknown } | null;
  const nome = typeof corpo?.nome === "string" ? corpo.nome.trim() : "";
  if (nome.length < 1 || nome.length > 40) {
    return respostaJson({ erro: "Informe seu nome com até 40 caracteres." }, 400);
  }

  const resultado = await executarRpc(request, "entrar_sala", {
    p_codigo: normalizarCodigoSala(params.codigo ?? ""),
    p_nome: nome,
  });
  if (resultado.response) return resultado.response;
  return respostaJson(resultado.data, 201);
};
