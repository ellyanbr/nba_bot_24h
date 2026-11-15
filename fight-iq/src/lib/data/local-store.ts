import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { TABLES, type TableName } from "@/lib/domain/types";
import { matches, type DataStore, type Filter, type Row } from "./store";
import { buildDemoDataset } from "./demo-seed";
import { migratePredictionGrading } from "./local-migrations";

type Database = { [K in TableName]: Row<K>[] };

const DB_PATH = process.env.LOCAL_DB_PATH
  ? path.resolve(process.env.LOCAL_DB_PATH)
  : path.join(process.cwd(), "data", "fightiq.local.json");

function emptyDb(): Database {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Database;
}

/**
 * Persistência local em arquivo JSON. Sem custo e sem dependências externas.
 * Na primeira execução, cria o arquivo com dados de DEMONSTRAÇÃO identificados.
 *
 * Limitação: adequado a um único processo (desenvolvimento/uso pessoal).
 * Em hospedagens serverless (sistema de arquivos efêmero/somente leitura) use o Supabase.
 */
export class LocalJsonStore implements DataStore {
  readonly backend = "local" as const;
  private cache: Database | null = null;
  private loading: Promise<Database> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  /** Carrega uma única vez, mesmo com várias requisições simultâneas. */
  private load(): Promise<Database> {
    if (this.cache) return Promise.resolve(this.cache);
    if (!this.loading) {
      this.loading = this.readOrSeed().catch((err) => {
        this.loading = null;
        throw err;
      });
    }
    return this.loading;
  }

  private async readOrSeed(): Promise<Database> {
    try {
      const raw = await fs.readFile(DB_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<Database>;
      const db = emptyDb();
      for (const t of TABLES) (db as Record<string, unknown[]>)[t] = parsed[t] ?? [];
      this.cache = db;
      if (migratePredictionGrading(db)) await this.persist();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      const db = emptyDb();
      const demo = buildDemoDataset();
      for (const t of TABLES) (db as Record<string, unknown[]>)[t] = demo[t] ?? [];
      this.cache = db;
      await this.persist();
    }
    return this.cache!;
  }

  private async persist() {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    const tmp = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.cache, null, 2), "utf8");
    await fs.rename(tmp, DB_PATH);
  }

  /** Serializa escritas para evitar condições de corrida. */
  private write<R>(fn: (db: Database) => R): Promise<R> {
    const run = this.queue.then(async () => {
      const db = await this.load();
      const result = fn(db);
      await this.persist();
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>) {
    const db = await this.load();
    return (db[table] as Row<T>[]).filter((r) => matches(r, filter)).map((r) => ({ ...r }));
  }

  async get<T extends TableName>(table: T, id: string) {
    const db = await this.load();
    const row = (db[table] as Row<T>[]).find((r) => (r as { id: string }).id === id);
    return row ? { ...row } : null;
  }

  insert<T extends TableName>(table: T, row: Row<T>) {
    return this.write((db) => {
      (db[table] as Row<T>[]).push(row);
      return { ...row };
    });
  }

  insertMany<T extends TableName>(table: T, rows: Row<T>[]) {
    return this.write((db) => {
      (db[table] as Row<T>[]).push(...rows);
    });
  }

  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    return this.write((db) => {
      const rows = db[table] as Row<T>[];
      const idx = rows.findIndex((r) => (r as { id: string }).id === id);
      if (idx < 0) throw new Error(`Registro não encontrado: ${table}/${id}`);
      rows[idx] = { ...rows[idx], ...patch, id } as Row<T>;
      return { ...rows[idx] };
    });
  }

  remove<T extends TableName>(table: T, id: string) {
    return this.write((db) => {
      (db as Record<string, unknown[]>)[table] = (db[table] as Row<T>[]).filter(
        (r) => (r as { id: string }).id !== id,
      );
    });
  }

  removeWhere<T extends TableName>(table: T, filter: Filter<T>) {
    return this.write((db) => {
      (db as Record<string, unknown[]>)[table] = (db[table] as Row<T>[]).filter(
        (r) => !matches(r, filter),
      );
    });
  }
}
