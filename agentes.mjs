import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const MODELO = "qwen3:8b";
const URL_OLLAMA = "http://localhost:11434/api/chat";

const executarComando = promisify(exec);
const pastaCalculator = fileURLToPath(
  new URL("./calculator/", import.meta.url),
);

async function executarTestes() {
  try {
    const { stdout, stderr } = await executarComando(
      "npm test -- --runInBand",
      {
        cwd: pastaCalculator,
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );

    return `STATUS: PASSOU\n${stdout}\n${stderr}`;
  } catch (erro) {
    if (erro.killed) {
      throw new Error("A execução do Jest excedeu 60 segundos.");
    }

    if (erro.code === "ENOENT") {
      throw new Error("Não foi possível iniciar o comando npm.");
    }

    return `STATUS: FALHOU (código ${erro.code})\n` +
      `${erro.stdout ?? ""}\n${erro.stderr ?? ""}`;
  }
}

async function consultarAgente(nome, instrucao, entrada) {
  console.log(`\n========== ${nome.toUpperCase()} ==========\n`);

  const resposta = await fetch(URL_OLLAMA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      stream: true,
      messages: [
        { role: "system", content: instrucao },
        { role: "user", content: entrada },
      ],
    }),
  });

  if (!resposta.ok) {
    throw new Error(
      `Ollama respondeu HTTP ${resposta.status}: ` +
      await resposta.text(),
    );
  }

  if (!resposta.body) {
    throw new Error("Ollama não retornou um corpo de resposta.");
  }

  let texto = "";
  let buffer = "";
  let avisouThinking = false;
  const decoder = new TextDecoder();

  function processarLinha(linha) {
    if (!linha.trim()) return;

    const evento = JSON.parse(linha);

    if (evento.error) {
      throw new Error(`Ollama: ${evento.error}`);
    }

    if (evento.message?.thinking && !avisouThinking) {
      process.stdout.write("[Modelo processando a tarefa...]\n");
      avisouThinking = true;
    }

    if (evento.message?.content) {
      process.stdout.write(evento.message.content);
      texto += evento.message.content;
    }
  }

  for await (const pedaco of resposta.body) {
    buffer += decoder.decode(pedaco, { stream: true });

    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";

    for (const linha of linhas) {
      processarLinha(linha);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    processarLinha(buffer);
  }

  if (!texto.trim()) {
    throw new Error(`${nome} terminou sem retornar conteúdo.`);
  }

  console.log("\n");
  return texto;
}

const tarefa = await readFile(
  new URL("./tarefas.txt", import.meta.url),
  "utf8",
);

const codigo = await readFile(
  new URL("./calculator/src/calcularDesconto.js", import.meta.url),
  "utf8",
);

const testes = await readFile(
  new URL(
    "./calculator/tests/calcularDesconto.test.js",
    import.meta.url,
  ),
  "utf8",
);

console.log("Executando os testes do código atual...");
const resultadoJest = await executarTestes();
console.log(resultadoJest);

const contexto = `
TAREFA:
${tarefa}

CÓDIGO ATUAL — src/calcularDesconto.js:
${codigo}

TESTES ATUAIS — tests/calcularDesconto.test.js:
${testes}

RESULTADO DO JEST NO CÓDIGO ATUAL:
${resultadoJest}
`;

const plano = await consultarAgente(
  "Planejador",
  `Você é um planejador técnico sênior.
O projeto usa CommonJS e Jest.
Leia a tarefa, o código e o resultado real dos testes.
Produza requisitos, passos de implementação e casos de teste.
Não afirme ter executado comandos.`,
  contexto,
);

const implementacao = await consultarAgente(
  "Desenvolvedor",
  `Você é um desenvolvedor JavaScript sênior.
O projeto usa CommonJS e Jest. Preserve essas escolhas.
Proponha o conteúdo corrigido de src/calcularDesconto.js.
Atenda aos critérios de aceitação da tarefa.
Não afirme ter alterado arquivos ou executado testes.`,
  `${contexto}\n\nPLANO DO OUTRO AGENTE:\n${plano}`,
);

const revisao = await consultarAgente(
  "Revisor",
  `Você é um revisor de código rigoroso.
Compare a implementação proposta com a tarefa e com o código atual.
Separe problemas obrigatórios de sugestões opcionais.
O resultado do Jest foi obtido ANTES da implementação proposta.
Não afirme que o código proposto passou nos testes.`,
  `${contexto}

PLANO:
${plano}

IMPLEMENTAÇÃO PROPOSTA:
${implementacao}`,
);

console.log("\n========== RESULTADO ==========");
console.log(`Planejamento: ${plano.length} caracteres`);
console.log(`Implementação: ${implementacao.length} caracteres`);
console.log(`Revisão: ${revisao.length} caracteres`);
console.log(
  "\nOs arquivos do calculator ainda não foram alterados pelos agentes.",
);