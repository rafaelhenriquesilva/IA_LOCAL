import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const executarArquivo = promisify(execFile);
const raizProjeto = fileURLToPath(new URL("../calculator/", import.meta.url));

export const ferramentas = [
  {
    type: "function",
    function: {
      name: "ler_arquivo",
      description:
        "Lê um arquivo de texto do projeto calculator. " +
        "Use caminhos relativos, como src/calcularDesconto.js.",
      parameters: {
        type: "object",
        properties: {
          caminho: {
            type: "string",
            description: "Caminho relativo ao projeto calculator.",
          },
        },
        required: ["caminho"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "executar_testes",
      description:
        "Executa todos os testes Jest do projeto calculator e retorna " +
        "o resultado real, incluindo falhas.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

export async function executarFerramenta(nome, argumentos) {
  if (nome === "executar_testes") {
    if (
      !argumentos ||
      typeof argumentos !== "object" ||
      Array.isArray(argumentos) ||
      Object.keys(argumentos).length !== 0
    ) {
      throw new Error("executar_testes não recebe argumentos.");
    }

    // Executa o CLI do Jest diretamente, evitando npm.cmd no Windows.
    const jest = path.join(
      raizProjeto,
      "node_modules",
      "jest",
      "bin",
      "jest.js",
    );

    try {
      const { stdout, stderr } = await executarArquivo(
        process.execPath,
        [jest, "--runInBand"],
        {
          cwd: raizProjeto,
          encoding: "utf8",
          timeout: 60_000,
          maxBuffer: 2 * 1024 * 1024,
        },
      );

      return {
        passou: true,
        codigoSaida: 0,
        stdout,
        stderr,
      };
    } catch (erro) {
      if (erro.killed || erro.signal) {
        throw new Error(
          "A execução do Jest foi interrompida ou excedeu 60 segundos.",
        );
      }

      if (typeof erro.code !== "number") {
        throw erro;
      }

      return {
        passou: false,
        codigoSaida: erro.code,
        stdout: erro.stdout ?? "",
        stderr: erro.stderr ?? "",
      };
    }
  }

  if (nome !== "ler_arquivo") {
    throw new Error(`Ferramenta desconhecida: ${nome}`);
  }

  if (
    !argumentos ||
    typeof argumentos.caminho !== "string" ||
    !argumentos.caminho.trim()
  ) {
    throw new Error("Informe um caminho válido.");
  }

  const caminho = argumentos.caminho;

  if (path.isAbsolute(caminho)) {
    throw new Error("Use um caminho relativo ao projeto.");
  }

  const raizReal = await realpath(raizProjeto);
  const destinoReal = await realpath(path.resolve(raizReal, caminho));
  const relativo = path.relative(raizReal, destinoReal);

  if (
    relativo === ".." ||
    relativo.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativo)
  ) {
    throw new Error("O arquivo precisa estar dentro de calculator.");
  }

  const partes = relativo.split(path.sep);

  if (partes.includes("node_modules") || partes.includes(".git")) {
    throw new Error("Essa pasta não está disponível para leitura.");
  }

  const extensoesPermitidas = new Set([
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".txt",
  ]);

  if (!extensoesPermitidas.has(path.extname(destinoReal))) {
    throw new Error("Tipo de arquivo não permitido.");
  }

  const conteudo = await readFile(destinoReal, "utf8");

  if (Buffer.byteLength(conteudo, "utf8") > 50_000) {
    throw new Error("Arquivo acima do limite de 50 KB.");
  }

  return {
    caminho: relativo.split(path.sep).join("/"),
    conteudo,
  };
}
