/**
 * Calcula o preço com desconto aplicado.
 * @param {number} preco - Preço original.
 * @param {number} percentual - Percentual de desconto (0 a 100).
 * @returns {number} Preço com desconto aplicado.
 * @throws {Error} Se o preço ou percentual forem inválidos.
 */
function calcularDesconto(preco, percentual) {
  if (!Number.isFinite(preco) || !Number.isFinite(percentual)) {
    throw new Error("Entrada inválida");
  }

  if (preco < 0) {
    throw new Error("Preço negativo");
  }

  if (percentual < 0 || percentual > 100) {
    throw new Error("Percentual inválido");
  }

  return preco * (1 - percentual / 100);
}

/**
 * Calcula o valor com acréscimo aplicado.
 * @param {number} valor - Valor original.
 * @param {number} percentual - Percentual de acréscimo (0 a 100).
 * @returns {number} Valor com acréscimo aplicado.
 * @throws {Error} Se o valor ou percentual forem inválidos.
 */
function calcularAcrescimo(valor, percentual) {
  if (!Number.isFinite(valor) || !Number.isFinite(percentual)) {
    throw new Error("Entrada inválida");
  }

  if (valor < 0) {
    throw new Error("Valor negativo");
  }

  if (percentual < 0 || percentual > 100) {
    throw new Error("Percentual inválido");
  }

  return valor * (1 + percentual / 100);
}

/**
 * Calcula o valor em centavos com desconto aplicado.
 * @param {number} precoEmCentavos - Preço em centavos (deve ser inteiro).
 * @param {number} percentual - Percentual de desconto (0 a 100).
 * @returns {number} Valor final em centavos após o desconto.
 * @throws {Error} Se o preço em centavos ou percentual forem inválidos.
 */
function calcularDescontoEmCentavos(precoEmCentavos, percentual) {
  if (!Number.isFinite(precoEmCentavos) || !Number.isFinite(percentual)) {
    throw new Error("Entrada inválida");
  }

  if (precoEmCentavos < 0) {
    throw new Error("Preço negativo");
  }

  if (percentual < 0 || percentual > 100) {
    throw new Error("Percentual inválido");
  }

  if (!Number.isInteger(precoEmCentavos)) {
    throw new Error("Preço em centavos deve ser um número inteiro");
  }

  const desconto = (precoEmCentavos * percentual) / 100;
  const valorFinal = precoEmCentavos - desconto;
  return Math.round(valorFinal);
}

module.exports = { calcularDesconto, calcularAcrescimo, calcularDescontoEmCentavos };