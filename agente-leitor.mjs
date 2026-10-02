/*
node .\agente-leitor.mjs "Execute os testes do projeto e informe se passaram, quantos testes foram executados e quais falharam."
node .\agente-leitor.mjs "Adicione comentários JSDoc às três funções de src/calcularDesconto.js, documentando parâmetros, retorno e erros conforme a implementação atual. Preserve o comportamento e os exports. Leia o código e os testes, execute Jest antes e depois da alteração."
node .\agente-leitor.mjs --exigir-escrita "Atualize o JSDoc de calcularDescontoEmCentavos: documente centavos inteiros, finitos e não negativos, percentual finito entre 0 e 100 e retorno inteiro arredondado com Math.round. Aplique a alteração usando escrever_arquivo. Preserve o comportamento e os exports."
*/
import { ferramentas, executarFerramenta } from "./lib/ferramentas.mjs";

const MODELO = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const URL_OLLAMA = "http://localhost:11434/api/chat";
const MAXIMO_RODADAS = 8;
const MAXIMO_ESCRITAS = 2;
let escritasRealizadas = 0;
const arquivosLidos = new Set();
let testesIniciaisPassaram = false;
const EXIGIR_ESCRITA = process.argv.includes("--exigir-escrita");
const pergunta =
  process.argv.slice(2)
    .filter((argumento) => argumento !== "--exigir-escrita")
    .join(" ") ||
  "Leia src/calcularDesconto.js e explique as funções existentes.";

const mensagens = [
  {
    role: "system",
    content: `
Você é um desenvolvedor JavaScript sênior.
Você pode ler arquivos, alterar src/calcularDesconto.js e executar Jest.

Para uma tarefa de alteração:
1. Leia o código e os testes existentes.
2. Execute os testes antes de alterar.
3. Faça a alteração solicitada preservando funções e exports CommonJS.
4. Execute os testes depois da alteração.
5. Se falharem, consulte a falha e tente corrigir respeitando o requisito.
6. Não altere os testes para esconder falhas.

A ferramenta de escrita exige o conteúdo completo do arquivo.
Você pode realizar no máximo duas escritas.
Não escreva novamente se a tarefa já estiver atendida.
Baseie suas afirmações nos resultados das ferramentas.
Responda em português e explique o que mudou e o resultado dos testes.
`,
  },
  {
    role: "user",
    content: pergunta,
  },
];

async function consultarModelo() {
  const resposta = await fetch(URL_OLLAMA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(600_000),
    body: JSON.stringify({
      model: MODELO,
      stream: false,
      think: false,
      tools: ferramentas,
      messages: mensagens,
      options: {
        temperature: 0,
        num_ctx: 8192,
        num_predict: 3000,
      },
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Ollama HTTP ${resposta.status}: ${await resposta.text()}`);
  }

  const resultado = await resposta.json();

  if (resultado.error) {
    throw new Error(resultado.error);
  }

  if (!resultado.message) {
    throw new Error("Ollama não retornou uma mensagem.");
  }

  return resultado.message;
}

async function main() {
  for (let rodada = 1; rodada <= MAXIMO_RODADAS; rodada++) {
    console.log(`\nConsultando modelo — rodada ${rodada}...`);

    const mensagem = await consultarModelo();
    mensagens.push(mensagem);

    const chamadas = mensagem.tool_calls ?? [];

    if (chamadas.length === 0) {
      if (!mensagem.content?.trim()) {
        throw new Error("O modelo terminou sem resposta.");
      }

      if (EXIGIR_ESCRITA && escritasRealizadas === 0) {
        console.log(
          "\nO modelo respondeu sem aplicar a alteração. Solicitando execução...",
        );

        mensagens.push({
          role: "user",
          content:
            "A tarefa exige uma alteração aplicada no arquivo. " +
            "Você ainda não executou escrever_arquivo. " +
            "Leia o código e os testes, execute Jest e use escrever_arquivo " +
            "para aplicar a alteração. Apenas mostrar código na resposta " +
            "não conclui a tarefa.",
        });

        continue;
      }

      console.log(`\n${mensagem.content}`);

      if (escritasRealizadas > 0) {
        console.log("\nVerificação final do programa: executando Jest...");

        const verificacao = await executarFerramenta("executar_testes", {});

        console.log(verificacao.stdout);
        console.log(verificacao.stderr);
        console.log(
          `Resultado final: ${verificacao.passou ? "PASSOU" : "FALHOU"}`,
        );

        if (!verificacao.passou) {
          process.exitCode = 1;
        }
      }

      return;
    }

    if (rodada === MAXIMO_RODADAS) {
      throw new Error("O agente atingiu o limite de rodadas.");
    }

    if (chamadas.length > 4) {
      throw new Error("O modelo solicitou ferramentas demais na rodada.");
    }

    for (const chamada of chamadas) {
      const nome = chamada.function?.name;
      const argumentos = chamada.function?.arguments;

      console.log(`Ferramenta solicitada: ${nome}`);
      console.log("Argumentos:", argumentos);

      let retorno;

      try {
  if (nome === "escrever_arquivo") {
    if (escritasRealizadas >= MAXIMO_ESCRITAS) {
      throw new Error("Limite de duas escritas atingido.");
    }

    const arquivosObrigatorios = [
      "src/calcularDesconto.js",
      "tests/calcularDesconto.test.js",
    ];

    if (!arquivosObrigatorios.every((arquivo) => arquivosLidos.has(arquivo))) {
      throw new Error(
        "Antes de escrever, leia src/calcularDesconto.js " +
        "e tests/calcularDesconto.test.js.",
      );
    }

    if (!testesIniciaisPassaram) {
      throw new Error(
        "Antes da primeira escrita, execute Jest e confirme que passou.",
      );
    }
  }

  const resultado = await executarFerramenta(nome, argumentos);

  if (nome === "ler_arquivo") {
    arquivosLidos.add(resultado.caminho);
  }

  if (nome === "executar_testes" && escritasRealizadas === 0) {
    testesIniciaisPassaram = resultado.passou === true;
  }

  if (nome === "escrever_arquivo") {
    escritasRealizadas++;
    console.log(`Escrita concluída: ${escritasRealizadas}/${MAXIMO_ESCRITAS}`);
  }

  retorno = {
    sucesso: true,
    resultado,
  };
} catch (erro) {
  console.error(`Ferramenta ${nome} falhou: ${erro.message}`);

  retorno = {
    sucesso: false,
    erro: erro.message,
  };
}

      mensagens.push({
        role: "tool",
        tool_name: nome,
        content: JSON.stringify(retorno),
      });
    }
  }
  throw new Error("Limite de rodadas atingido sem concluir a tarefa.");
}

main().catch((erro) => {
  console.error(`\nFalha: ${erro.message}`);
  process.exitCode = 1;
});
