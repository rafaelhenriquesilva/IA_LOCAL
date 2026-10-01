// node .\agente-leitor.mjs "Execute os testes do projeto e informe se passaram, quantos testes foram executados e quais falharam."
import { ferramentas, executarFerramenta } from "./lib/ferramentas.mjs";

const MODELO = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const URL_OLLAMA = "http://localhost:11434/api/chat";
const MAXIMO_RODADAS = 4;

const pergunta =
  process.argv.slice(2).join(" ") ||
  "Leia src/calcularDesconto.js e explique as funções existentes.";

const mensagens = [
  {
    role: "system",
    content: `
Você é um desenvolvedor JavaScript sênior.
Use ler_arquivo para consultar código antes de analisá-lo.
Quando o usuário solicitar testes, use executar_testes.
Informe aprovação ou falha somente com base no resultado da ferramenta.
Se a ferramenta falhar, explique a falha sem inventar resultados.
Você pode ler arquivos e executar Jest.
Responda em português, de forma objetiva.
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
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      model: MODELO,
      stream: false,
      think: false,
      tools: ferramentas,
      messages: mensagens,
      options: {
        temperature: 0,
        num_ctx: 8192,
        num_predict: 1000,
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

      console.log(`\n${mensagem.content}`);
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
        retorno = {
          sucesso: true,
          resultado: await executarFerramenta(nome, argumentos),
        };
      } catch (erro) {
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
}

main().catch((erro) => {
  console.error(`\nFalha: ${erro.message}`);
  process.exitCode = 1;
});
