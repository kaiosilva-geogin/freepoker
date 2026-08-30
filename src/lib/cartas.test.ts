import { describe, expect, it } from "vitest";
import { calcularMedia, conjuntoCartasValido, rotuloCarta } from "./cartas";

describe("cartas", () => {
  it("calcula a média ignorando opções não numéricas", () => {
    expect(calcularMedia(["3", "5", "?", "cafe"])).toBe(4);
  });

  it("retorna null quando não há votos numéricos", () => {
    expect(calcularMedia(["?", "cafe"])).toBeNull();
  });

  it("identifica conjuntos e apresenta café", () => {
    expect(conjuntoCartasValido("fibonacci")).toBe(true);
    expect(conjuntoCartasValido("aleatorio")).toBe(false);
    expect(rotuloCarta("cafe")).toBe("☕");
  });
});
