// `changeset version` only updates package.json, so server.json is synced here.
import { readFileSync, writeFileSync } from "node:fs";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

const { version } = readJson("package.json");
const server = readJson("server.json");

server.version = version;
for (const pkg of server.packages) {
  pkg.version = version;
}

writeFileSync("server.json", `${JSON.stringify(server, null, 2)}\n`);
