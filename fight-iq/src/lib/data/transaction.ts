import type { TableName } from "@/lib/domain/types";
import { ConstraintError, matches, type BatchOp, type DataReader, type DataStore, type Filter, type Row } from "./store";

type AnyRow = Record<string, unknown> & { id: string };

interface Overlay {
  inserted: Map<string, AnyRow>;
  patched: Map<string, Record<string, unknown>>;
  deleted: Set<string>;
}

/**
 * Transação em memória sobre uma base de leitura.
 *
 * As escritas não tocam a base: são registradas em `ops` (aplicadas depois, de uma vez,
 * pelo backend) e numa camada sobreposta que faz as leituras da transação enxergarem
 * as próprias escritas. Se `fn` lançar erro, nada é aplicado.
 */
export class BatchTransaction implements DataStore {
  readonly ops: BatchOp[] = [];
  private overlays = new Map<TableName, Overlay>();

  constructor(
    private base: DataReader,
    readonly backend: "local" | "supabase",
  ) {}

  private overlay(table: TableName): Overlay {
    let o = this.overlays.get(table);
    if (!o) {
      o = { inserted: new Map(), patched: new Map(), deleted: new Set() };
      this.overlays.set(table, o);
    }
    return o;
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const o = this.overlay(table);
    if (o.deleted.has(id)) return null;
    const ins = o.inserted.get(id);
    if (ins) return { ...ins } as unknown as Row<T>;
    const row = await this.base.get(table, id);
    if (!row) return null;
    return { ...row, ...(o.patched.get(id) ?? {}) } as Row<T>;
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    const o = this.overlay(table);
    const baseRows = (await this.base.list(table, filter)) as unknown as AnyRow[];
    const seen = new Set(baseRows.map((r) => r.id));
    // Linhas alteradas nesta transação que não vieram no filtro original podem passar a combinar.
    for (const id of o.patched.keys()) {
      if (!seen.has(id)) {
        const r = (await this.base.get(table, id)) as unknown as AnyRow | null;
        if (r) baseRows.push(r);
      }
    }
    const out = baseRows
      .filter((r) => !o.deleted.has(r.id))
      .map((r) => ({ ...r, ...(o.patched.get(r.id) ?? {}) }))
      .filter((r) => matches(r, filter as Partial<AnyRow>));
    for (const r of o.inserted.values()) if (matches(r, filter as Partial<AnyRow>)) out.push({ ...r });
    return out as unknown as Row<T>[];
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const r = { ...(row as unknown as AnyRow) };
    if (!r.id) throw new ConstraintError(`Registro sem id em ${table}.`);
    const o = this.overlay(table);
    // Duplicidade dentro da transação é detectada aqui; contra o banco, pela chave primária
    // no momento de aplicar o lote (evita uma consulta por linha em importações grandes).
    if (o.inserted.has(r.id)) throw new ConstraintError(`Registro duplicado em ${table} (id ${r.id}).`);
    o.deleted.delete(r.id);
    o.inserted.set(r.id, r);
    this.ops.push({ op: "insert", table, row: r });
    return { ...r } as unknown as Row<T>;
  }

  async insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<void> {
    for (const r of rows) await this.insert(table, r);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const current = await this.get(table, id);
    if (!current) throw new ConstraintError(`Registro não encontrado: ${table}/${id}`);
    const clean = Object.fromEntries(Object.entries(patch as Record<string, unknown>).filter(([k, v]) => k !== "id" && v !== undefined));
    const o = this.overlay(table);
    const ins = o.inserted.get(id);
    if (ins) o.inserted.set(id, { ...ins, ...clean });
    else o.patched.set(id, { ...(o.patched.get(id) ?? {}), ...clean });
    this.ops.push({ op: "update", table, id, patch: clean });
    return { ...current, ...clean } as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const o = this.overlay(table);
    o.inserted.delete(id);
    o.patched.delete(id);
    o.deleted.add(id);
    this.ops.push({ op: "delete", table, id });
  }

  async removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void> {
    if (!Object.values(filter).some((v) => v !== undefined)) throw new Error("removeWhere exige um filtro.");
    for (const r of await this.list(table, filter)) await this.remove(table, (r as unknown as AnyRow).id);
  }

  /** Transação aninhada: participa da mesma transação. */
  atomic<R>(fn: (tx: DataStore) => Promise<R>): Promise<R> {
    return fn(this);
  }
}
