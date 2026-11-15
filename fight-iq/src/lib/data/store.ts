import type { TableMap, TableName } from "@/lib/domain/types";

export type Row<T extends TableName> = TableMap[T];
export type Filter<T extends TableName> = Partial<Row<T>>;

/** Operação de escrita registrada numa transação (sempre por id, para ser aplicável em SQL). */
export type BatchOp =
  | { op: "insert"; table: TableName; row: Record<string, unknown> }
  | { op: "update"; table: TableName; id: string; patch: Record<string, unknown> }
  | { op: "delete"; table: TableName; id: string };

/** Leitura mínima usada como base de uma transação. */
export interface DataReader {
  list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
}

/**
 * Contrato de persistência independente de tecnologia.
 * Implementações: LocalJsonStore (padrão, R$ 0, sem internet) e SupabaseStore (opcional).
 */
export interface DataStore extends DataReader {
  readonly backend: "local" | "supabase";
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void>;
  /**
   * Executa `fn` como uma transação: todas as escritas feitas em `tx` são aplicadas
   * juntas ou nenhuma é aplicada. Leituras em `tx` enxergam as escritas da própria transação.
   * Dentro de `fn`, use SOMENTE `tx` (nunca o store original) para ler e gravar.
   */
  atomic<R>(fn: (tx: DataStore) => Promise<R>): Promise<R>;
}

/**
 * Restrições de unicidade equivalentes às do esquema SQL (além da chave primária `id`).
 * O banco local aplica as mesmas regras para ter o mesmo comportamento do Supabase.
 */
export const UNIQUE_CONSTRAINTS: Partial<Record<TableName, string[]>> = {
  organizations: ["slug"],
  fight_results: ["fightId"],
};

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConstraintError";
  }
}

export function matches<T extends object>(row: T, filter?: Partial<T>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(
    ([k, v]) => v === undefined || (row as Record<string, unknown>)[k] === v,
  );
}
