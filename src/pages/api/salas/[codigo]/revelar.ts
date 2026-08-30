import type { APIRoute } from "astro";
import { normalizarCodigoSala } from "../../../../lib/codigo-sala";
import { executarRpc } from "../../../../lib/rpc-servidor";
import { respostaJson } from "../../../../lib/supabase-servidor";

export const POST: APIRoute = async ({ params, request }) => {
  const resultado = await executarRpc(request, "revelar_votos", {
    p_codigo: normalizarCodigoSala(params.codigo ?? ""),
  });
  if (resultado.response) return resultado.response;
  return respostaJson({ sucesso: true });
};
