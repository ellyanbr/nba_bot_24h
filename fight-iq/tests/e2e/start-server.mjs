// Recria o banco temporário dos testes e inicia o servidor de produção.
import { spawn } from "node:child_process";
import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";

const db = process.env.LOCAL_DB_PATH;
if (!db || !db.startsWith("test-results/")) {
  console.error("LOCAL_DB_PATH deve apontar para test-results/ (proteção contra apagar o banco real).");
  process.exit(1);
}
mkdirSync(path.dirname(db), { recursive: true });
rmSync(db, { force: true });

const child = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", process.env.PORT ?? "3210"], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
