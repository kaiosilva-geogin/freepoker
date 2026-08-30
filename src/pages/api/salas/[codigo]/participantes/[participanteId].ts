import type { APIRoute } from "astro";
import { normalizarCodigoSala } from "../../../../../lib/codigo-sala";
import { executarRpc } from "../../../../../lib/rpc-servidor";
import { respostaJson } from "../../../../../lib/supabase-servidor";

export const DELETE: APIRoute = async ({ params, request }) => {
  const participanteId = params.participanteId ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(participanteId)) {
    return respostaJson({ erro: "Participante inválido." }, 400);
  }

  const resultado = await executarRpc(request, "remover_participante", {
    p_codigo: normalizarCodigoSala(params.codigo ?? ""),
    p_participante_id: participanteId,
  });
  if (resultado.response) return resultado.response;
  return respostaJson({ sucesso: true });
};
