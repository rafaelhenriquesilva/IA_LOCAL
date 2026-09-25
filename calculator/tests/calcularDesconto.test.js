const { calcularDesconto } = require("../src/calcularDesconto");

describe("calcularDesconto", () => {
  test("aplica o desconto", () => {
    expect(calcularDesconto(100, 20)).toBe(80);
  });

  test("aceita as bordas de 0% e 100%", () => {
    expect(calcularDesconto(50, 0)).toBe(50);
    expect(calcularDesconto(50, 100)).toBe(0);
  });

  test("rejeita preço negativo", () => {
    expect(() => calcularDesconto(-1, 20)).toThrow("Preço negativo");
  });

  test("rejeita percentual fora do intervalo", () => {
    expect(() => calcularDesconto(100, -1)).toThrow("Percentual inválido");
    expect(() => calcularDesconto(100, 101)).toThrow("Percentual inválido");
  });

  test("rejeita entradas que não são números finitos", () => {
    expect(() => calcularDesconto("100", 20)).toThrow();
    expect(() => calcularDesconto(100, NaN)).toThrow();
    expect(() => calcularDesconto(Infinity, 20)).toThrow();
  });
});
