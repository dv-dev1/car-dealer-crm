// `npm run ai:key`: puts the OpenAI key from ../secrets/openai.local.json ({ "apiKey": "..." }) into .dev.vars.
// It never prints the value.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SOURCE = "../secrets/openai.local.json";
if (!existsSync(SOURCE)) {
  console.error(`Falta ${SOURCE}. Crie o arquivo com { "apiKey": "..." } (modo 0600).`);
  process.exit(1);
}
const { apiKey } = JSON.parse(readFileSync(SOURCE, "utf8"));
if (typeof apiKey !== "string" || apiKey.trim() === "" || /\s/.test(apiKey.trim())) {
  console.error(`${SOURCE} precisa do campo "apiKey" com a chave.`);
  process.exit(1);
}
const current = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
const kept = current.split("\n").filter((line) => !line.startsWith("OPENAI_API_KEY="));
while (kept.at(-1) === "") kept.pop();
writeFileSync(".dev.vars", [...kept, `OPENAI_API_KEY=${apiKey.trim()}`, ""].join("\n"), { mode: 0o600 });
console.log("OPENAI_API_KEY gravada no .dev.vars. Reinicie o preview.");
