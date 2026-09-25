function calcularDesconto(preco, percentual) {
  if (preco < 0) {
    throw new Error("Preço negativo");
  }

  if (percentual < 0 || percentual > 100) {
    throw new Error("Percentual inválido");
  }

  return preco * (1 - percentual / 100);
}

module.exports = { calcularDesconto };