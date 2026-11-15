import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { TABLES, type TableName } from "@/lib/domain/types";
import { applyBatchToMemory, type MemoryDb } from "./apply-batch";
import { matches, type DataStore, type Filter, type Row } from "./store";
import { BatchTransaction } from "./transaction";
import { buildDemoDataset } from "./demo-seed";
import { migrateIntegrity, migratePredictionGrading } from "./local-migrations";

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
      // Migrações locais (idempotentes); grava o arquivo só se algo mudou.
      const changed = [migratePredictionGrading(db), migrateIntegrity(db as never)].some(Boolean);
      if (changed) await this.persist();
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

  /** Fila única: transações locais são executadas uma de cada vez (serializáveis). */
  private enqueue<R>(job: () => Promise<R>): Promise<R> {
    const run = this.queue.then(job);
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

  /**
   * Transação local: lê o estado atual, acumula as escritas, aplica tudo numa cópia
   * e grava o arquivo uma única vez (escrita em arquivo temporário + rename atômico).
   * Qualquer erro — na lógica, numa restrição ou na gravação — descarta tudo.
   */
  atomic<R>(fn: (tx: DataStore) => Promise<R>): Promise<R> {
    return this.enqueue(async () => {
      await this.load();
      const tx = new BatchTransaction({ list: (t, f) => this.list(t, f), get: (t, id) => this.get(t, id) }, "local");
      const result = await fn(tx);
      if (tx.ops.length) {
        const previous = this.cache!;
        this.cache = applyBatchToMemory(previous as unknown as MemoryDb, tx.ops) as unknown as Database;
        try {
          await this.persist();
        } catch (err) {
          this.cache = previous; // rollback em memória: o arquivo não foi substituído
          throw err;
        }
      }
      return result;
    });
  }

  insert<T extends TableName>(table: T, row: Row<T>) {
    return this.atomic((tx) => tx.insert(table, row));
  }

  insertMany<T extends TableName>(table: T, rows: Row<T>[]) {
    return this.atomic((tx) => tx.insertMany(table, rows));
  }

  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    return this.atomic((tx) => tx.update(table, id, patch));
  }

  remove<T extends TableName>(table: T, id: string) {
    return this.atomic((tx) => tx.remove(table, id));
  }

  removeWhere<T extends TableName>(table: T, filter: Filter<T>) {
    return this.atomic((tx) => tx.removeWhere(table, filter));
  }
}
