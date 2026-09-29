import {
  readFile,
  readdir,
  writeFile,
  mkdir,
  rm,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = new URL("./", import.meta.url);
const pastaExecucoes = new URL("./execucoes/", raiz);
const pastaLocks = new URL("./execucoes/.locks/", raiz);

const tarefa = await readFile(
  new URL("./tarefas.txt", raiz),
  "utf8",
);

const id = tarefa.match(/^ID:\s*([A-Z]+-\d+)\s*$/m)?.[1];

if (!id) {
  throw new Error("A tarefa precisa de uma linha como: ID: CALC-004");
}

const retry = process.argv.includes("--retry");

await mkdir(pastaExecucoes, { recursive: true });
await mkdir(pastaLocks, { recursive: true });

const arquivoEstado = new URL(`./${id}.estado.json`, pastaExecucoes);
const pastaLock = new URL(`./${id}/`, pastaLocks);

async function lerEstado() {
  try {
    return JSON.parse(await readFile(arquivoEstado, "utf8"));
  } catch (erro) {
    if (erro.code === "ENOENT") return null;
    throw erro;
  }
}

async function existeExecucaoComTestesPassando() {
  const nomes = await readdir(pastaExecucoes);

  for (const nome of nomes) {
    if (!nome.startsWith(`${id}-`) || !nome.endsWith(".json")) {
      continue;
    }

    const registro = JSON.parse(
      await readFile(new URL(nome, pastaExecucoes), "utf8"),
    );

    if (registro.jestDepois === "passou") {
      return true;
    }
  }

  return false;
}

const estadoAnterior = await lerEstado();

if (await existeExecucaoComTestesPassando()) {
  console.log(
    `${id} já passou nos testes e aguarda revisão. Nada será executado.`,
  );
  process.exit(0);
}

if (estadoAnterior?.status === "falhou" && !retry) {
  console.log(
    `${id} falhou anteriormente. Use node worker.mjs --retry para tentar novamente.`,
  );
  process.exit(1);
}

if (
  estadoAnterior?.status === "executando" &&
  !retry
) {
  console.log(
    `${id} consta como executando. Verifique o processo antes de tentar novamente.`,
  );
  process.exit(1);
}

try {
  // Criar a pasta é uma operação exclusiva: só um worker assume o ID.
  await mkdir(pastaLock);
} catch (erro) {
  if (erro.code === "EEXIST") {
    console.log(`${id} já está sendo processada por outro worker.`);
    process.exit(1);
  }

  throw erro;
}

const estado = {
  id,
  status: "executando",
  iniciadoEm: new Date().toISOString(),
  tentativa: (estadoAnterior?.tentativa ?? 0) + 1,
};

try {
  await writeFile(
    arquivoEstado,
    JSON.stringify(estado, null, 2),
    "utf8",
  );

  console.log(`Worker assumiu ${id}, tentativa ${estado.tentativa}.`);

  const filho = spawn(
    process.execPath,
    [fileURLToPath(new URL("./agentes.mjs", raiz))],
    {
      cwd: fileURLToPath(raiz),
      stdio: "inherit",
    },
  );

  const codigoSaida = await new Promise((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });

  const testesPassaram =
    codigoSaida === 0 &&
    await existeExecucaoComTestesPassando();

  estado.status = testesPassaram
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
  process.exitCode = testesPassaram ? 0 : 1;
} catch (erro) {
  estado.status = "falhou";
  estado.finalizadoEm = new Date().toISOString();
  estado.erro = erro.message;

  await writeFile(
    arquivoEstado,
    JSON.stringify(estado, null, 2),
    "utf8",
  );

  throw erro;
} finally {
  await rm(pastaLock, { recursive: true, force: true });
}