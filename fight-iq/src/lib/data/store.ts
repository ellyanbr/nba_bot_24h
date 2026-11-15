import type { TableMap, TableName } from "@/lib/domain/types";

export type Row<T extends TableName> = TableMap[T];
export type Filter<T extends TableName> = Partial<Row<T>>;

/**
 * Contrato de persistência independente de tecnologia.
 * Implementações: LocalJsonStore (padrão, R$ 0, sem internet) e SupabaseStore (opcional).
 */
export interface DataStore {
  readonly backend: "local" | "supabase";
  list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void>;
}

export function matches<T extends object>(row: T, filter?: Partial<T>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(
    ([k, v]) => v === undefined || (row as Record<string, unknown>)[k] === v,
  );
}
