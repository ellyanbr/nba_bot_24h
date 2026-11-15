import { TABLES, type TableName } from "@/lib/domain/types";
import { ConstraintError, UNIQUE_CONSTRAINTS, type BatchOp } from "./store";

export type MemoryDb = Record<TableName, Record<string, unknown>[]>;

/**
 * Aplica um lote de operações a uma CÓPIA do banco em memória e a retorna.
 * Mesma semântica da função SQL fightiq_apply_batch: tudo ou nada, chave primária
 * e unicidades verificadas, atualização de registro inexistente é erro.
 */
export function applyBatchToMemory(db: MemoryDb, ops: BatchOp[]): MemoryDb {
  const next = structuredClone(db);
  for (const op of ops) {
    if (!TABLES.includes(op.table)) throw new ConstraintError(`Tabela não permitida: ${op.table}`);
    const rows = (next[op.table] ??= []);
    if (op.op === "insert") {
      const id = op.row.id as string;
      if (rows.some((r) => r.id === id)) throw new ConstraintError(`Registro duplicado em ${op.table} (id ${id}).`);
      for (const col of UNIQUE_CONSTRAINTS[op.table] ?? []) {
        if (op.row[col] != null && rows.some((r) => r[col] === op.row[col])) {
          throw new ConstraintError(`Valor duplicado em ${op.table}.${col}: ${String(op.row[col])}`);
        }
      }
      rows.push({ ...op.row });
    } else if (op.op === "update") {
      const idx = rows.findIndex((r) => r.id === op.id);
      if (idx < 0) throw new ConstraintError(`Registro não encontrado: ${op.table}/${op.id}`);
      const updated: Record<string, unknown> = { ...rows[idx], ...op.patch, id: op.id };
      for (const col of UNIQUE_CONSTRAINTS[op.table] ?? []) {
        if (col in op.patch && updated[col] != null && rows.some((r, i) => i !== idx && r[col] === updated[col])) {
          throw new ConstraintError(`Valor duplicado em ${op.table}.${col}: ${String(updated[col])}`);
        }
      }
      rows[idx] = updated;
    } else {
      next[op.table] = rows.filter((r) => r.id !== op.id);
    }
  }
  return next;
}
