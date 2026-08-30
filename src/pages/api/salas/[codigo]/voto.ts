import type { APIRoute } from "astro";
import { normalizarCodigoSala } from "../../../../lib/codigo-sala";
import { executarRpc } from "../../../../lib/rpc-servidor";
import { respostaJson } from "../../../../lib/supabase-servidor";

export const POST: APIRoute = async ({ params, request }) => {
  const corpo = (await request.json().catch(() => null)) as { valor?: unknown } | null;
  const valor = typeof corpo?.valor === "string" ? corpo.valor : "";
  if (!/^(0|1|2|3|4|5|6|7|8|9|10|13|20|21|40|100|\?|cafe)$/.test(valor)) {
    return respostaJson({ erro: "Escolha uma carta válida." }, 400);
  }

  const resultado = await executarRpc(request, "registrar_voto", {
    p_codigo: normalizarCodigoSala(params.codigo ?? ""),
    p_valor: valor,
  });
  if (resultado.response) return resultado.response;
  return respostaJson({ sucesso: true });
};
