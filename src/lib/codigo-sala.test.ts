import { describe, expect, it } from "vitest";
import { codigoSalaValido, normalizarCodigoSala } from "./codigo-sala";

describe("normalizarCodigoSala", () => {
  it("normaliza letras, espaços e separadores", () => {
    expect(normalizarCodigoSala(" 7kq-9xp ")).toBe("7KQ9XP");
  });

  it("extrai o código de um link de sala", () => {
    expect(normalizarCodigoSala("https://freepoker.dev/sala/7kq9xp?origem=chat")).toBe("7KQ9XP");
  });

  it("valida apenas códigos suportados", () => {
    expect(codigoSalaValido("7KQ9XP")).toBe(true);
    expect(codigoSalaValido("7KQ9X")).toBe(false);
    expect(codigoSalaValido("7KQ1XP")).toBe(false);
  });
});
