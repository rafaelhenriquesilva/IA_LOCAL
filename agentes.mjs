import { readFile, writeFile, mkdir } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const MODELO = "qwen3:8b";
const URL_OLLAMA = "http://localhost:11434/api/chat";

const ESQUEMA_PROPOSTA = {
  type: "object",
  additionalProperties: false,
  properties: {
    arquivos: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          caminho: { type: "string" },
          conteudo: { type: "string" },
        },
        required: ["caminho", "conteudo"],
      },
    },
  },
  required: ["arquivos"],
};

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

    return {
      passou: true,
      relatorio: `STATUS: PASSOU\n${stdout}\n${stderr}`,
    };
  } catch (erro) {
    if (erro.killed) {
      throw new Error("A execução do Jest excedeu 60 segundos.");
    }

    return {
      passou: false,
      relatorio:
        `STATUS: FALHOU (código ${erro.code})\n` +
        `${erro.stdout ?? ""}\n${erro.stderr ?? ""}`,
    };
  }
}

async function consultarAgente(nome, instrucao, entrada, json = false) {
  console.log(`\n========== ${nome.toUpperCase()} ==========\n`);

  const resposta = await fetch(URL_OLLAMA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      stream: true,
      ...(json ? { format: ESQUEMA_PROPOSTA } : {}),
      options: {
        temperature: 0,
        num_ctx: 8192,
      },
      messages: [
        { role: "system", content: instrucao },
        { role: "user", content: entrada },
      ],
    }),
  });

  if (!resposta.ok) {
    throw new Error(
      `Ollama respondeu HTTP ${resposta.status}: ` + (await resposta.text()),
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

if (!tarefa.includes("ID: CALC-002")) {
  throw new Error(
    "tarefas.txt não contém a CALC-002. Nenhum arquivo foi alterado.",
  );
}

const arquivosPermitidos = new Map([
  [
    "src/calcularDesconto.js",
    new URL("./calculator/src/calcularDesconto.js", import.meta.url),
  ],
  [
    "tests/calcularDesconto.test.js",
    new URL("./calculator/tests/calcularDesconto.test.js", import.meta.url),
  ],
]);

const codigoAnterior = await readFile(
  arquivosPermitidos.get("src/calcularDesconto.js"),
  "utf8",
);

const testesAnteriores = await readFile(
  arquivosPermitidos.get("tests/calcularDesconto.test.js"),
  "utf8",
);

console.log("Executando Jest antes da alteração...");
const antes = await executarTestes();
console.log(antes.relatorio);

const contexto = `
TAREFA:
${tarefa}

CÓDIGO ATUAL — src/calcularDesconto.js:
${codigoAnterior}

TESTES ATUAIS — tests/calcularDesconto.test.js:
${testesAnteriores}

JEST ANTES DA ALTERAÇÃO:
${antes.relatorio}
`;

const plano = await consultarAgente(
  "Planejador",
  `Você é um planejador técnico sênior.
O projeto usa CommonJS e Jest.
Planeje a implementação da tarefa e os casos de teste.
Preserve a função calcularDesconto.
Não afirme ter executado comandos.`,
  contexto,
);

const respostaDesenvolvedor = await consultarAgente(
  "Desenvolvedor",
  `Você é um desenvolvedor JavaScript sênior.

Responda SOMENTE com JSON válido neste formato:
{
  "arquivos": [
    {
      "caminho": "src/calcularDesconto.js",
      "conteudo": "CONTEÚDO COMPLETO DO ARQUIVO"
    },
    {
      "caminho": "tests/calcularDesconto.test.js",
      "conteudo": "CONTEÚDO COMPLETO DO ARQUIVO"
    }
  ]
}

Regras:
- Retorne exatamente esses dois arquivos.
- Cada conteudo deve conter o arquivo inteiro.
- Preserve CommonJS, Jest e todos os testes existentes.
- Acrescente testes para calcularAcrescimo.
- Não inclua Markdown fora do JSON.
- Não afirme ter executado os testes.`,
  `${contexto}\n\nPLANO:\n${plano}`,
  true,
);

let proposta;

try {
  proposta = JSON.parse(respostaDesenvolvedor);
} catch {
  throw new Error(
    "O Desenvolvedor retornou JSON inválido. Nenhum arquivo foi alterado.",
  );
}

if (!Array.isArray(proposta.arquivos) || proposta.arquivos.length !== 2) {
  throw new Error("A proposta deve conter exatamente dois arquivos.");
}

const caminhosRecebidos = new Set();

for (const arquivo of proposta.arquivos) {
  if (
    !arquivo ||
    !arquivosPermitidos.has(arquivo.caminho) ||
    caminhosRecebidos.has(arquivo.caminho) ||
    typeof arquivo.conteudo !== "string" ||
    !arquivo.conteudo.trim() ||
    arquivo.conteudo.length > 30_000
  ) {
    throw new Error(
      "A proposta contém arquivo não permitido, duplicado ou inválido.",
    );
  }

  caminhosRecebidos.add(arquivo.caminho);
}

if (caminhosRecebidos.size !== arquivosPermitidos.size) {
  throw new Error("Falta um dos arquivos obrigatórios.");
}

console.log("\nAplicando os dois arquivos permitidos...");

for (const arquivo of proposta.arquivos) {
  await writeFile(
    arquivosPermitidos.get(arquivo.caminho),
    arquivo.conteudo,
    "utf8",
  );
}

console.log("\nExecutando Jest depois da alteração...");
const depois = await executarTestes();
console.log(depois.relatorio);

const codigoAplicado = await readFile(
  arquivosPermitidos.get("src/calcularDesconto.js"),
  "utf8",
);

const testesAplicados = await readFile(
  arquivosPermitidos.get("tests/calcularDesconto.test.js"),
  "utf8",
);

const revisao = await consultarAgente(
  "Revisor",
  `Você é um revisor de código rigoroso.
Compare tarefa, arquivos anteriores, arquivos aplicados e resultado posterior do Jest.
Verifique se calcularDesconto foi preservada e se os novos testes cobrem calcularAcrescimo.
Separe problemas obrigatórios de sugestões opcionais.
Recomende aprovação ou correção com justificativa concreta.
Não afirme ter executado comandos.`,
  `${contexto}

CÓDIGO APLICADO:
${codigoAplicado}

TESTES APLICADOS:
${testesAplicados}

JEST DEPOIS DA ALTERAÇÃO:
${depois.relatorio}`,
);

const pastaExecucoes = new URL("./execucoes/", import.meta.url);

await mkdir(pastaExecucoes, { recursive: true });

const registro = {
  idTarefa: "CALC-002",
  modelo: MODELO,
  concluidoEm: new Date().toISOString(),
  arquivosAlterados: [...caminhosRecebidos],
  jestAntes: antes.passou ? "passou" : "falhou",
  jestDepois: depois.passou ? "passou" : "falhou",
  relatorioJest: depois.relatorio,
  revisao,
};

const nomeRegistro = `CALC-002-${Date.now()}.json`;

await writeFile(
  new URL(nomeRegistro, pastaExecucoes),
  JSON.stringify(registro, null, 2),
  "utf8",
);

console.log("\n========== RESUMO ==========");
console.log(`Jest antes: ${registro.jestAntes}`);
console.log(`Jest depois: ${registro.jestDepois}`);
console.log(`Registro: execucoes/${nomeRegistro}`);
console.log("Revise o diff antes de fazer commit.");
