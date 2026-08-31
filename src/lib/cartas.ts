export const CONJUNTOS_CARTAS = {
  padrao: {
    nome: "Padrão",
    cartas: ["cafe", "2", "4", "8", "13", "18", "21", "28", "34", "44", "56", "70", "86", "100"],
  },
  fibonacci: {
    nome: "Fibonacci",
    cartas: ["0", "1", "2", "3", "5", "8", "13", "21", "?", "cafe"],
  },
  fibonacci_estendida: {
    nome: "Fibonacci estendida",
    cartas: ["0", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "cafe"],
  },
  sequencial: {
    nome: "Sequencial",
    cartas: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?", "cafe"],
  },
} as const;

export type ConjuntoCartas = keyof typeof CONJUNTOS_CARTAS;

export function conjuntoCartasValido(valor: string): valor is ConjuntoCartas {
  return valor in CONJUNTOS_CARTAS;
}

export function rotuloCarta(valor: string): string {
  return valor === "cafe" ? "☕" : valor;
}

export function calcularMedia(valores: string[]): number | null {
  const numeros = valores
    .filter((valor) => valor !== "" && valor !== "?" && valor !== "cafe")
    .map(Number)
    .filter(Number.isFinite);

  if (numeros.length === 0) return null;
  return numeros.reduce((soma, numero) => soma + numero, 0) / numeros.length;
}
