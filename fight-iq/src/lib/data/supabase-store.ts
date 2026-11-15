import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TableName } from "@/lib/domain/types";
import type { DataStore, Filter, Row } from "./store";

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function mapKeys(obj: unknown, fn: (k: string) => string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [fn(k), v]));
}
const fromDb = <R,>(row: unknown) => mapKeys(row, toCamel) as unknown as R;

/** Tamanho de página: não pode exceder o "Max rows" da API do projeto Supabase (padrão 1000). */
export const PAGE_SIZE = 1000;

/**
 * Adaptador Supabase (PostgreSQL). Opcional — ativado com DATA_BACKEND=supabase.
 * Executa somente no servidor, com a service role key lida de variável de ambiente
 * (nunca exposta ao navegador). Esquema em supabase/migrations/0001_init.sql.
 */
export class SupabaseStore implements DataStore {
  readonly backend = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, serviceKey: string, client?: SupabaseClient) {
    this.client = client ?? createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private fail(op: string, table: string, error: { message: string } | null): never {
    throw new Error(`Supabase ${op} em ${table}: ${error?.message ?? "erro desconhecido"}`);
  }

  /**
   * Lê TODAS as linhas, em páginas. O PostgREST/Supabase limita cada resposta
   * (padrão de 1000 linhas); sem paginar, tabelas grandes seriam cortadas sem aviso.
   * A ordenação por id garante páginas estáveis.
   */
  async list<T extends TableName>(table: T, filter?: Filter<T>) {
    const f = filter
      ? mapKeys(Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined)), toSnake)
      : {};
    const rows: Row<T>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let q = this.client.from(table).select("*");
      if (Object.keys(f).length) q = q.match(f);
      const { data, error } = await q.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) this.fail("list", table, error);
      const page = data ?? [];
      rows.push(...page.map((r) => fromDb<Row<T>>(r)));
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  async get<T extends TableName>(table: T, id: string) {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) this.fail("get", table, error);
    return data ? (fromDb<Row<T>>(data)) : null;
  }

  async insert<T extends TableName>(table: T, row: Row<T>) {
    const { data, error } = await this.client
      .from(table)
      .insert(mapKeys(row, toSnake))
      .select()
      .single();
    if (error) this.fail("insert", table, error);
    return fromDb<Row<T>>(data);
  }

  async insertMany<T extends TableName>(table: T, rows: Row<T>[]) {
    if (!rows.length) return;
    const { error } = await this.client
      .from(table)
      .insert(rows.map((r) => mapKeys(r, toSnake)));
    if (error) this.fail("insertMany", table, error);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    const { data, error } = await this.client
      .from(table)
      .update(mapKeys(patch, toSnake))
      .eq("id", id)
      .select()
      .single();
    if (error) this.fail("update", table, error);
    return fromDb<Row<T>>(data);
  }

  async remove<T extends TableName>(table: T, id: string) {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) this.fail("delete", table, error);
  }

  async removeWhere<T extends TableName>(table: T, filter: Filter<T>) {
    const f = mapKeys(filter, toSnake);
    if (!Object.keys(f).length) throw new Error("removeWhere exige um filtro.");
    const { error } = await this.client.from(table).delete().match(f);
    if (error) this.fail("delete", table, error);
  }
}
