import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = new URL("./", import.meta.url);
const tarefa = await readFile(new URL("./tarefas.txt", raiz), "utf8");

const id = tarefa.match(/^ID:\s*([A-Z]+-\d+)\s*$/m)?.[1];

if (!id) {
  throw new Error("A tarefa precisa de uma linha como: ID: CALC-003");
}

const pastaExecucoes = new URL("./execucoes/", raiz);
await mkdir(pastaExecucoes, { recursive: true });

const registros = await readdir(pastaExecucoes);

if (registros.some((nome) => nome.startsWith(`${id}-`) && nome.endsWith(".json"))) {
  console.log(`${id} já possui uma execução concluída. Nada será executado.`);
  process.exit(0);
}

const arquivoEstado = new URL(`./${id}.estado.json`, pastaExecucoes);

const estado = {
  id,
  status: "executando",
  iniciadoEm: new Date().toISOString(),
};

try {
  // "wx" cria o arquivo somente se ele ainda não existir.
  await writeFile(
    arquivoEstado,
    JSON.stringify(estado, null, 2),
    { encoding: "utf8", flag: "wx" },
  );
} catch (erro) {
  if (erro.code === "EEXIST") {
    console.log(`${id} já foi assumida por uma execução. Nada será executado.`);
    process.exit(0);
  }

  throw erro;
}

console.log(`Worker assumiu ${id}. Iniciando agentes...`);

const processo = spawn(
  process.execPath,
  [fileURLToPath(new URL("./agentes.mjs", raiz))],
  {
    cwd: fileURLToPath(raiz),
    stdio: "inherit",
  },
);

const codigoSaida = await new Promise((resolve, reject) => {
  processo.once("error", reject);
  processo.once("close", resolve);
});

estado.status = codigoSaida === 0
  ? "aguardando_revisao"
  : "falhou";

estado.finalizadoEm = new Date().toISOString();
estado.codigoSaida = codigoSaida;

await writeFile(
  arquivoEstado,
  JSON.stringify(estado, null, 2),
  "utf8",
);

console.log(`Worker finalizou ${id}: ${estado.status}`);
process.exitCode = codigoSaida === 0 ? 0 : 1;