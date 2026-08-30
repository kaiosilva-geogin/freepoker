import type { ConjuntoCartas } from "./cartas";

export type EstadoSala = "votando" | "revelado" | "encerrado";

export interface SalaResumo {
  id: string;
  codigo: string;
  nome: string;
  conjuntoCartas: ConjuntoCartas;
  estado: EstadoSala;
  numeroRodada: number;
  proprietario: boolean;
}

export interface ParticipanteSala {
  id: string;
  nome: string;
  ativo: boolean;
  votou: boolean;
  proprietario: boolean;
  ultimaAtividadeEm: string;
}

export interface VotoRevelado {
  participanteId: string;
  valor: string;
}
