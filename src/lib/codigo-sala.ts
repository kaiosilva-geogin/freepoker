const TAMANHO_CODIGO = 6;

export function normalizarCodigoSala(entrada: string): string {
  const valor = entrada.trim();

  try {
    const url = new URL(valor);
    const partes = url.pathname.split("/").filter(Boolean);
    const indiceSala = partes.findIndex((parte) => parte.toLowerCase() === "sala");
    if (indiceSala >= 0 && partes[indiceSala + 1]) {
      return limpar(partes[indiceSala + 1]);
    }
  } catch {
    // A entrada é um código, não uma URL.
  }

  return limpar(valor);
}

function limpar(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TAMANHO_CODIGO);
}

export function codigoSalaValido(codigo: string): boolean {
  return /^[A-Z2-9]{6}$/.test(codigo);
}
