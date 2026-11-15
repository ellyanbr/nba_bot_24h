import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

export const MIGRATIONS_DIR = path.join(__dirname, "../../supabase/migrations");

export function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
}

/**
 * Conecta ao banco de testes. Por segurança, o nome do banco precisa conter "test"
 * (ou FIGHTIQ_ALLOW_DB_RESET=1), porque a suíte recria o schema public.
 */
export async function connectTestDb(): Promise<Client> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL para um banco PostgreSQL descartável (veja vitest.db.config.mts).");
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName) && process.env.FIGHTIQ_ALLOW_DB_RESET !== "1") {
    throw new Error(`Recusado: o banco "${dbName}" não parece ser de teste. Use um nome com "test" ou FIGHTIQ_ALLOW_DB_RESET=1.`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/** Recria o schema e aplica papéis do Supabase (simulados) + todas as migrações em ordem. */
export async function resetAndMigrate(client: Client) {
  await client.query("drop schema if exists public cascade; create schema public; grant all on schema public to public;");
  await client.query(fs.readFileSync(path.join(__dirname, "supabase-roles.sql"), "utf8"));
  for (const f of migrationFiles()) {
    await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
  }
}

/** Lê linhas como o PostgREST as serializa (JSON), para comparar com o formato da aplicação. */
export async function selectJson(client: Client, table: string, where = "true", params: unknown[] = []) {
  const { rows } = await client.query(`select to_jsonb(t) as j from ${table} t where ${where} order by id`, params);
  return rows.map((r) => r.j as Record<string, unknown>);
}
