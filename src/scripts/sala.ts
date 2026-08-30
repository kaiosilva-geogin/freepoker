import type { RealtimeChannel } from "@supabase/supabase-js";
import { requisicaoApi } from "../lib/api-cliente";
import { calcularMedia, CONJUNTOS_CARTAS, rotuloCarta, type ConjuntoCartas } from "../lib/cartas";
import { garantirSessaoAnonima, obterSupabase, supabaseConfigurado } from "../lib/supabase-cliente";

interface EstadoRecebido {
  sala: {
    id: string;
    codigo: string;
    nome: string;
    conjunto_cartas: ConjuntoCartas;
    estado: "votando" | "revelado" | "encerrado";
    numero_rodada: number;
    proprietario: boolean;
  };
  participante_atual: { id: string; nome: string; votou: boolean; ativo: boolean; voto: string | null } | null;
  participantes: Array<{
    id: string;
    nome: string;
    votou: boolean;
    proprietario: boolean;
    ultima_atividade_em: string;
  }>;
  votos: Array<{ participante_id: string; valor: string }>;
}

const raiz = document.querySelector<HTMLElement>("[data-room-code]");
const codigo = raiz?.dataset.roomCode ?? "";
let estado: EstadoRecebido | null = null;
let votoSelecionado: string | null = null;
let canal: RealtimeChannel | null = null;
let participanteParaRemover: { id: string; nome: string } | null = null;
let timerToast: number | null = null;

const elementos = {
  loading: document.querySelector<HTMLElement>("[data-room-loading]"),
  error: document.querySelector<HTMLElement>("[data-room-error]"),
  errorTitle: document.querySelector<HTMLElement>("[data-room-error-title]"),
  errorMessage: document.querySelector<HTMLElement>("[data-room-error-message]"),
  content: document.querySelector<HTMLElement>("[data-room-content]"),
  roomName: document.querySelector<HTMLElement>("[data-room-name]"),
  roundLabel: document.querySelector<HTMLElement>("[data-round-label]"),
  votingTitle: document.querySelector<HTMLElement>("[data-voting-title]"),
  votingDescription: document.querySelector<HTMLElement>("[data-voting-description]"),
  roomStatus: document.querySelector<HTMLElement>("[data-room-status]"),
  cards: document.querySelector<HTMLElement>("[data-cards]"),
  results: document.querySelector<HTMLElement>("[data-results]"),
  resultVotes: document.querySelector<HTMLElement>("[data-result-votes]"),
  average: document.querySelector<HTMLElement>("[data-average]"),
  participantCount: document.querySelector<HTMLElement>("[data-participant-count]"),
  participants: document.querySelector<HTMLElement>("[data-participants]"),
  ownerControls: document.querySelector<HTMLElement>("[data-owner-controls]"),
  reveal: document.querySelector<HTMLButtonElement>("[data-reveal]"),
  newRound: document.querySelector<HTMLButtonElement>("[data-new-round]"),
  joinDialog: document.querySelector<HTMLDialogElement>("#entrar-na-sala"),
  joinForm: document.querySelector<HTMLFormElement>("[data-join-form]"),
  joinMessage: document.querySelector<HTMLElement>("[data-join-message]"),
  removeDialog: document.querySelector<HTMLDialogElement>("#confirmar-remocao"),
  removeName: document.querySelector<HTMLElement>("[data-remove-name]"),
  toast: document.querySelector<HTMLElement>("[data-toast]"),
  leave: document.querySelector<HTMLButtonElement>("[data-leave]"),
};

void iniciar();

async function iniciar() {
  if (!supabaseConfigurado()) {
    mostrarErro("Serviço indisponível", "A conexão com as salas ainda não está disponível neste ambiente.");
    return;
  }

  try {
    await garantirSessaoAnonima();
    await carregarEstado(true);
  } catch (erro) {
    mostrarErro("Sala indisponível", mensagemErro(erro));
  }
}

async function carregarEstado(inicial = false) {
  try {
    const proximoEstado = await requisicaoApi<EstadoRecebido>(`/api/salas/${codigo}/estado`);
    estado = proximoEstado;

    if (!estado.participante_atual) {
      elementos.loading?.setAttribute("hidden", "");
      abrirEntrada();
      return;
    }

    votoSelecionado = estado.participante_atual.voto;
    renderizar();
    if (inicial) await assinarRealtime();
  } catch (erro) {
    const mensagem = mensagemErro(erro);
    if (mensagem.toLowerCase().includes("removida")) {
      mostrarErro("Você foi removido", "Esta sessão não participa mais da sala. Abra uma nova aba para entrar novamente.");
      return;
    }
    throw erro;
  }
}

function abrirEntrada() {
  const nomeSalvo = sessionStorage.getItem(`freepoker:sala:${codigo}:nome`);
  const input = elementos.joinForm?.querySelector<HTMLInputElement>("input[name='nome']");
  if (input && nomeSalvo) input.value = nomeSalvo;
  if (!elementos.joinDialog?.open) elementos.joinDialog?.showModal();
  window.setTimeout(() => input?.focus(), 50);
}

elementos.joinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formulario = event.currentTarget as HTMLFormElement;
  const botao = formulario.querySelector<HTMLButtonElement>("button[type='submit']");
  const nome = String(new FormData(formulario).get("nome") ?? "").trim();
  definirBotao(botao, true, "Entrando…");
  if (elementos.joinMessage) elementos.joinMessage.textContent = "";

  try {
    await requisicaoApi(`/api/salas/${codigo}/participantes`, {
      method: "POST",
      body: JSON.stringify({ nome }),
    });
    sessionStorage.setItem(`freepoker:sala:${codigo}:nome`, nome);
    elementos.joinDialog?.close();
    await carregarEstado(true);
  } catch (erro) {
    if (elementos.joinMessage) elementos.joinMessage.textContent = mensagemErro(erro);
    definirBotao(botao, false, "Entrar na sala");
  }
});

function renderizar() {
  if (!estado) return;
  elementos.loading?.setAttribute("hidden", "");
  elementos.error?.setAttribute("hidden", "");
  elementos.content?.removeAttribute("hidden");
  if (elementos.roomName) elementos.roomName.textContent = estado.sala.nome;
  document.title = `${estado.sala.nome} — FreePoker`;
  if (elementos.roundLabel) elementos.roundLabel.textContent = `Rodada ${estado.sala.numero_rodada}`;

  const revelado = estado.sala.estado === "revelado";
  if (elementos.votingTitle) elementos.votingTitle.textContent = revelado ? "Votos da equipe" : "Escolha uma carta";
  if (elementos.votingDescription) {
    elementos.votingDescription.textContent = revelado
      ? "A rodada foi revelada. Confira as estimativas abaixo."
      : "Seu voto permanecerá oculto até a revelação.";
  }
  if (elementos.roomStatus) {
    elementos.roomStatus.textContent = revelado ? "Votos revelados" : "Votação aberta";
  }

  renderizarCartas(revelado);
  renderizarParticipantes();
  renderizarResultados(revelado);
  renderizarControles(revelado);
}

function renderizarCartas(revelado: boolean) {
  if (!estado || !elementos.cards) return;
  const conjunto = CONJUNTOS_CARTAS[estado.sala.conjunto_cartas];
  elementos.cards.replaceChildren(
    ...conjunto.cartas.map((valor) => {
      const botao = document.createElement("button");
      botao.className = "vote-card";
      botao.type = "button";
      botao.textContent = rotuloCarta(valor);
      botao.disabled = revelado;
      botao.setAttribute("aria-label", valor === "cafe" ? "Carta café" : `Carta ${valor}`);
      botao.setAttribute("aria-pressed", String(votoSelecionado === valor));
      botao.addEventListener("click", () => void votar(valor, botao));
      return botao;
    }),
  );
}

async function votar(valor: string, botao: HTMLButtonElement) {
  if (!estado || estado.sala.estado !== "votando") return;
  const anterior = votoSelecionado;
  votoSelecionado = valor;
  elementos.cards?.querySelectorAll("button").forEach((carta) => carta.setAttribute("aria-pressed", "false"));
  botao.setAttribute("aria-pressed", "true");

  try {
    await requisicaoApi(`/api/salas/${codigo}/voto`, {
      method: "POST",
      body: JSON.stringify({ valor }),
    });
    if (estado.participante_atual) estado.participante_atual.votou = true;
    mostrarToast("Voto registrado");
  } catch (erro) {
    votoSelecionado = anterior;
    renderizarCartas(false);
    mostrarToast(mensagemErro(erro));
  }
}

function renderizarParticipantes() {
  if (!estado || !elementos.participants) return;
  if (elementos.participantCount) elementos.participantCount.textContent = String(estado.participantes.length);
  elementos.participants.replaceChildren(
    ...estado.participantes.map((participante) => {
      const item = document.createElement("li");
      item.className = `participant ${participante.votou ? "participant--voted" : ""}`;

      const avatar = document.createElement("span");
      avatar.className = "participant__avatar";
      avatar.textContent = participante.nome.slice(0, 2);

      const info = document.createElement("div");
      info.className = "participant__info";
      const nome = document.createElement("span");
      nome.className = "participant__name";
      nome.textContent = participante.nome;
      const meta = document.createElement("span");
      meta.className = "participant__meta";
      meta.textContent = participante.proprietario ? "Proprietário" : participante.id === estado?.participante_atual?.id ? "Você" : "Participante";
      info.append(nome, meta);

      const acoes = document.createElement("div");
      acoes.className = "participant__actions";

      if (participante.votou) {
        const carta = document.createElement("span");
        carta.className = "participant__voted-card";
        carta.setAttribute("aria-label", "Voto registrado");
        carta.setAttribute("role", "img");
        carta.innerHTML = '<i></i><i></i><i></i>';
        acoes.append(carta);
      } else {
        const estadoVoto = document.createElement("span");
        estadoVoto.className = "participant__state";
        estadoVoto.textContent = "Aguardando";
        acoes.append(estadoVoto);
      }

      if (!participante.proprietario && estado?.sala.proprietario) {
        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "participant__remove";
        remover.setAttribute("aria-label", `Remover ${participante.nome}`);
        remover.textContent = "×";
        remover.addEventListener("click", () => abrirRemocao(participante.id, participante.nome));
        acoes.append(remover);
      }

      item.append(avatar, info, acoes);
      return item;
    }),
  );
}

function renderizarResultados(revelado: boolean) {
  if (!estado) return;
  if (!revelado) {
    elementos.results?.setAttribute("hidden", "");
    return;
  }

  elementos.results?.removeAttribute("hidden");
  const valores = estado.votos.map((voto) => voto.valor);
  const media = calcularMedia(valores);
  if (elementos.average) elementos.average.textContent = media === null ? "—" : formatarMedia(media);
  if (!elementos.resultVotes) return;

  const votosPorParticipante = new Map(estado.votos.map((voto) => [voto.participante_id, voto.valor]));
  elementos.resultVotes.replaceChildren(
    ...estado.participantes.map((participante) => {
      const item = document.createElement("div");
      item.className = "result-vote";
      const valor = votosPorParticipante.get(participante.id);
      const carta = document.createElement("strong");
      carta.textContent = valor ? rotuloCarta(valor) : "—";
      const nome = document.createElement("span");
      nome.textContent = valor ? participante.nome : `${participante.nome} · sem voto`;
      item.append(carta, nome);
      return item;
    }),
  );
}

function renderizarControles(revelado: boolean) {
  if (!estado) return;
  elementos.ownerControls?.toggleAttribute("hidden", !estado.sala.proprietario);
  elementos.reveal?.toggleAttribute("hidden", revelado);
  elementos.newRound?.toggleAttribute("hidden", !revelado);
  elementos.leave?.toggleAttribute("hidden", estado.sala.proprietario);
}

elementos.reveal?.addEventListener("click", async (event) =>
  executarComando(event.currentTarget as HTMLButtonElement, "Revelando…", "revelar"),
);
elementos.newRound?.addEventListener("click", async (event) =>
  executarComando(event.currentTarget as HTMLButtonElement, "Iniciando…", "nova-votacao"),
);

async function executarComando(botao: HTMLButtonElement, carregando: string, acao: string) {
  const textoOriginal = botao.textContent ?? "";
  definirBotao(botao, true, carregando);
  try {
    await requisicaoApi(`/api/salas/${codigo}/${acao}`, { method: "POST" });
    if (acao === "nova-votacao") votoSelecionado = null;
    await carregarEstado();
  } catch (erro) {
    mostrarToast(mensagemErro(erro));
  } finally {
    definirBotao(botao, false, textoOriginal);
  }
}

function abrirRemocao(id: string, nome: string) {
  participanteParaRemover = { id, nome };
  if (elementos.removeName) elementos.removeName.textContent = nome;
  elementos.removeDialog?.showModal();
}

document.querySelector("[data-cancel-remove]")?.addEventListener("click", () => elementos.removeDialog?.close());
document.querySelector<HTMLButtonElement>("[data-confirm-remove]")?.addEventListener("click", async (event) => {
  const botao = event.currentTarget as HTMLButtonElement;
  if (!participanteParaRemover) return;
  definirBotao(botao, true, "Removendo…");
  try {
    await requisicaoApi(`/api/salas/${codigo}/participantes/${participanteParaRemover.id}`, { method: "DELETE" });
    elementos.removeDialog?.close();
    await carregarEstado();
    mostrarToast("Participante removido");
  } catch (erro) {
    mostrarToast(mensagemErro(erro));
  } finally {
    definirBotao(botao, false, "Remover participante");
    participanteParaRemover = null;
  }
});

document.querySelector("[data-copy-room]")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/sala/${codigo}`);
    mostrarToast("Link da sala copiado");
  } catch {
    mostrarToast(`Código da sala: ${codigo}`);
  }
});

elementos.leave?.addEventListener("click", async () => {
  try {
    await requisicaoApi(`/api/salas/${codigo}/sair`, { method: "POST" });
  } finally {
    sessionStorage.removeItem(`freepoker:sala:${codigo}:nome`);
    window.location.assign("/");
  }
});

async function assinarRealtime() {
  if (!estado || canal) return;
  const supabase = obterSupabase();
  const sessao = await garantirSessaoAnonima();
  await supabase.realtime.setAuth(sessao.access_token);
  canal = supabase
    .channel(`sala:${estado.sala.id}`, { config: { private: true } })
    .on("broadcast", { event: "sala_atualizada" }, () => void carregarEstado())
    .on("broadcast", { event: "participantes_atualizados" }, () => void carregarEstado())
    .on("broadcast", { event: "votacao_atualizada" }, () => void carregarEstado())
    .subscribe();
}

function mostrarErro(titulo: string, mensagem: string) {
  elementos.loading?.setAttribute("hidden", "");
  elementos.content?.setAttribute("hidden", "");
  elementos.error?.removeAttribute("hidden");
  if (elementos.roomName) elementos.roomName.textContent = "Sala indisponível";
  if (elementos.errorTitle) elementos.errorTitle.textContent = titulo;
  if (elementos.errorMessage) elementos.errorMessage.textContent = mensagem;
}

function mostrarToast(mensagem: string) {
  if (!elementos.toast) return;
  elementos.toast.textContent = mensagem;
  elementos.toast.removeAttribute("hidden");
  if (timerToast) window.clearTimeout(timerToast);
  timerToast = window.setTimeout(() => elementos.toast?.setAttribute("hidden", ""), 2600);
}

function definirBotao(botao: HTMLButtonElement | null, carregando: boolean, texto: string) {
  if (!botao) return;
  botao.disabled = carregando;
  botao.textContent = texto;
}

function mensagemErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}

function formatarMedia(media: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(media);
}
