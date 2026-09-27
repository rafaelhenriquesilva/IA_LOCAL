const { calcularDesconto, calcularAcrescimo, calcularDescontoEmCentavos } = require("../src/calcularDesconto");

describe("calcularDesconto", () => {
  // Testes existentes para calcularDesconto
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
    expect(() => calcularDesconto("100", 20)).toThrow("Entrada inválida");
    expect(() => calcularDesconto(100, NaN)).toThrow("Entrada inválida");
    expect(() => calcularDesconto(Infinity, 20)).toThrow("Entrada inválida");
  });
});

describe("calcularAcrescimo", () => {
  test("aplica o acréscimo", () => {
    expect(calcularAcrescimo(100, 20)).toBe(120);
  });

  test("aceita as bordas de 0% e 100%", () => {
    expect(calcularAcrescimo(50, 0)).toBe(50);
    expect(calcularAcrescimo(50, 100)).toBe(100);
  });

  test("rejeita valor negativo", () => {
    expect(() => calcularAcrescimo(-1, 20)).toThrow("Valor negativo");
  });

  test("rejeita percentual fora do intervalo", () => {
    expect(() => calcularAcrescimo(100, -1)).toThrow("Percentual inválido");
    expect(() => calcularAcrescimo(100, 101)).toThrow("Percentual inválido");
  });

  test("rejeita entradas que não são números finitos", () => {
    expect(() => calcularAcrescimo("100", 20)).toThrow("Entrada inválida");
    expect(() => calcularAcrescimo(100, NaN)).toThrow("Entrada inválida");
    expect(() => calcularAcrescimo(Infinity, 20)).toThrow("Entrada inválida");
  });
});

describe("calcularDescontoEmCentavos", () => {
  test("10000 centavos com 20% de desconto retorna 8000", () => {
    expect(calcularDescontoEmCentavos(10000, 20)).toBe(8000);
  });

  test("999 centavos com 50% de desconto retorna 500", () => {
    expect(calcularDescontoEmCentavos(999, 50)).toBe(500);
  });

  test("0% mantém o valor; 100% retorna zero", () => {
    expect(calcularDescontoEmCentavos(500, 0)).toBe(500);
    expect(calcularDescontoEmCentavos(500, 100)).toBe(0);
  });

  test("rejeita centavos fracionários, negativos, strings, NaN e Infinity", () => {
    expect(() => calcularDescontoEmCentavos(100.5, 20)).toThrow("Preço em centavos deve ser um número inteiro");
    expect(() => calcularDescontoEmCentavos(-100, 20)).toThrow("Preço negativo");
    expect(() => calcularDescontoEmCentavos("100", 20)).toThrow("Entrada inválida");
    expect(() => calcularDescontoEmCentavos(NaN, 20)).toThrow("Entrada inválida");
    expect(() => calcularDescontoEmCentavos(Infinity, 20)).toThrow("Entrada inválida");
  });

  test("rejeita percentuais fora do intervalo e não finitos", () => {
    expect(() => calcularDescontoEmCentavos(100, -1)).toThrow("Percentual inválido");
    expect(() => calcularDescontoEmCentavos(100, 101)).toThrow("Percentual inválido");
    expect(() => calcularDescontoEmCentavos(100, NaN)).toThrow("Entrada inválida");
    expect(() => calcularDescontoEmCentavos(100, Infinity)).toThrow("Entrada inválida");
  });
});