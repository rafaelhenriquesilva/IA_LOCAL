import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// node .\revisar.mjs CALC-003 aprovar
const [id, decisao] = process.argv.slice(2);

if (!/^[A-Z]+-\d+$/.test(id ?? "")) {
  throw new Error(
    "Informe o ID da tarefa. Exemplo: node .\\revisar.mjs CALC-003 aprovar",
  );
}

if (!["aprovar", "rejeitar"].includes(decisao)) {
  throw new Error('A decisão deve ser "aprovar" ou "rejeitar".');
}

const pastaExecucoes = new URL("./execucoes/", import.meta.url);
const arquivoEstado = new URL(`./${id}.estado.json`, pastaExecucoes);

let estado;

try {
  estado = JSON.parse(await readFile(arquivoEstado, "utf8"));
} catch (erro) {
  if (erro.code === "ENOENT") {
    throw new Error(`Não encontrei o estado da tarefa ${id}.`);
  }

  throw erro;
}

if (estado.id !== id) {
  throw new Error("O ID do arquivo de estado não corresponde à tarefa.");
}

if (estado.status !== "aguardando_revisao") {
  throw new Error(
    `${id} está com status "${estado.status}". ` +
    "Só é possível revisar uma tarefa aguardando revisão.",
  );
}

const nomes = await readdir(pastaExecucoes);
const registros = nomes
  .filter((nome) => nome.startsWith(`${id}-`) && nome.endsWith(".json"))
  .sort();

if (registros.length === 0) {
  throw new Error(`${id} não possui registro de execução.`);
}

const nomeRegistro = registros.at(-1);
const registro = JSON.parse(
  await readFile(new URL(nomeRegistro, pastaExecucoes), "utf8"),
);

if (registro.idTarefa !== id) {
  throw new Error("O registro de execução pertence a outra tarefa.");
}

if (decisao === "aprovar" && registro.jestDepois !== "passou") {
  throw new Error(
    `Não é possível aprovar ${id}: o Jest não passou após a alteração.`,
  );
}

estado.status = decisao === "aprovar" ? "aprovada" : "rejeitada";
estado.revisadoEm = new Date().toISOString();
estado.registroRevisado = nomeRegistro;

await writeFile(
  fileURLToPath(arquivoEstado),
  JSON.stringify(estado, null, 2) + "\n",
  "utf8",
);

console.log(`${id}: ${estado.status}`);
console.log(`Execução revisada: ${nomeRegistro}`);