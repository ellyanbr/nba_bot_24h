/**
 * Nenhuma chave secreta pode chegar ao navegador.
 * Varre o código enviado ao cliente (.next/static) após `npm run build`.
 * Verifica os NOMES das variáveis sensíveis e, quando definidos no ambiente, os VALORES.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const STATIC_DIR = path.join(import.meta.dirname, "../../.next/static");
const SENSITIVE = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "AI_API_KEY", "APP_BASIC_AUTH_PASSWORD", "APP_BASIC_AUTH_USER", "DATABASE_URL", "service_role"];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

describe.skipIf(!fs.existsSync(STATIC_DIR))("bundle do navegador (.next/static)", () => {
  const bundle = files(STATIC_DIR)
    .filter((f) => /\.(js|css|json|html)$/.test(f))
    .map((f) => ({ f, text: fs.readFileSync(f, "utf8") }));

  it("não contém nomes de variáveis sensíveis", () => {
    for (const name of SENSITIVE) {
      const hits = bundle.filter((b) => b.text.includes(name)).map((b) => path.relative(STATIC_DIR, b.f));
      expect(hits, name).toEqual([]);
    }
  });

  it("não contém valores de segredos definidos no ambiente", () => {
    const values = ["SUPABASE_SERVICE_ROLE_KEY", "AI_API_KEY", "APP_BASIC_AUTH_PASSWORD"].map((k) => process.env[k]).filter((v): v is string => Boolean(v && v.length >= 8));
    for (const v of values) expect(bundle.some((b) => b.text.includes(v))).toBe(false);
  });
});
