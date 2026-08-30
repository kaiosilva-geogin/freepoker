import { requisicaoApi } from "../lib/api-cliente";
import { codigoSalaValido, normalizarCodigoSala } from "../lib/codigo-sala";
import { supabaseConfigurado } from "../lib/supabase-cliente";

const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog.app-dialog");

document.querySelectorAll<HTMLButtonElement>("[data-open-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.openDialog ?? "") as HTMLDialogElement | null;
    dialog?.showModal();
    window.setTimeout(() => dialog?.querySelector<HTMLInputElement>("input")?.focus(), 50);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

dialogs.forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

const formCriar = document.querySelector<HTMLFormElement>("#form-criar-sala");
formCriar?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const botao = formCriar.querySelector<HTMLButtonElement>("button[type='submit']");
  const mensagem = formCriar.querySelector<HTMLElement>("[data-form-message]");
  const dados = new FormData(formCriar);

  if (!supabaseConfigurado()) {
    definirMensagem(mensagem, "Configure as variáveis do Supabase para criar uma sala.");
    return;
  }

  definirCarregando(botao, true, "Criando…");
  definirMensagem(mensagem, "");

  try {
    const resposta = await requisicaoApi<{ codigo: string }>("/api/salas", {
      method: "POST",
      body: JSON.stringify({
        nomeCriador: dados.get("nomeCriador"),
        nomeSala: dados.get("nomeSala"),
        conjuntoCartas: dados.get("conjuntoCartas"),
      }),
    });

    sessionStorage.setItem(`freepoker:sala:${resposta.codigo}:nome`, String(dados.get("nomeCriador") ?? ""));
    window.location.assign(`/sala/${resposta.codigo}`);
  } catch (erro) {
    definirMensagem(mensagem, erro instanceof Error ? erro.message : "Não foi possível criar a sala.");
    definirCarregando(botao, false, "Criar sala");
  }
});

const formEntrar = document.querySelector<HTMLFormElement>("#form-entrar-sala");
formEntrar?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const botao = formEntrar.querySelector<HTMLButtonElement>("button[type='submit']");
  const mensagem = formEntrar.querySelector<HTMLElement>("[data-form-message]");
  const entrada = String(new FormData(formEntrar).get("codigoSala") ?? "");
  const codigo = normalizarCodigoSala(entrada);

  if (!codigoSalaValido(codigo)) {
    definirMensagem(mensagem, "Informe um código de sala válido com 6 caracteres.");
    return;
  }

  if (!supabaseConfigurado()) {
    definirMensagem(mensagem, "Configure as variáveis do Supabase para consultar uma sala.");
    return;
  }

  definirCarregando(botao, true, "Consultando…");
  definirMensagem(mensagem, "");

  try {
    await requisicaoApi(`/api/salas/${codigo}`);
    window.location.assign(`/sala/${codigo}`);
  } catch (erro) {
    definirMensagem(mensagem, erro instanceof Error ? erro.message : "Sala não encontrada.");
    definirCarregando(botao, false, "Continuar");
  }
});

function definirMensagem(elemento: HTMLElement | null, texto: string) {
  if (elemento) elemento.textContent = texto;
}

function definirCarregando(botao: HTMLButtonElement | null, carregando: boolean, texto: string) {
  if (!botao) return;
  botao.disabled = carregando;
  botao.textContent = texto;
}
