import { garantirSessaoAnonima } from "./supabase-cliente";

interface OpcoesRequisicao extends RequestInit {
  anonima?: boolean;
}

export async function requisicaoApi<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const sessao = opcoes.anonima === false ? null : await garantirSessaoAnonima();
  const headers = new Headers(opcoes.headers);
  headers.set("Accept", "application/json");
  if (opcoes.body) headers.set("Content-Type", "application/json");
  if (sessao) headers.set("Authorization", `Bearer ${sessao.access_token}`);

  const resposta = await fetch(caminho, { ...opcoes, headers });
  const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string } & T;

  if (!resposta.ok) {
    throw new Error(corpo.erro || "Não foi possível concluir a solicitação.");
  }

  return corpo;
}
