import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, ".vercel/output/functions/__server.func/_libs");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");

if (!existsSync(destDir)) {
  console.log("[pglite] no server bundle yet — skip");
  process.exit(0);
}

for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(join(srcDir, name), join(destDir, name));
}
console.log("[pglite] copied database assets next to the server bundle");
