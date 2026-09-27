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