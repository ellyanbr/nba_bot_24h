import { describe, expect, it } from "vitest";
import { applyBatchToMemory, type MemoryDb } from "@/lib/data/apply-batch";
import type { DataReader } from "@/lib/data/store";
import { BatchTransaction } from "@/lib/data/transaction";
import { TABLES } from "@/lib/domain/types";

function memDb(seed: Partial<Record<string, Record<string, unknown>[]>> = {}): MemoryDb {
  return Object.fromEntries(TABLES.map((t) => [t, structuredClone(seed[t] ?? [])])) as MemoryDb;
}
function reader(db: MemoryDb): DataReader {
  return {
    list: async (t, f) =>
      db[t].filter((r) => Object.entries(f ?? {}).every(([k, v]) => v === undefined || r[k] === v)).map((r) => ({ ...r })) as never,
    get: async (t, id) => (db[t].find((r) => r.id === id) as never) ?? null,
  };
}

describe("BatchTransaction — leituras enxergam as próprias escritas", () => {
  it("insert/update/remove refletem em get e list, sem tocar a base", async () => {
    const db = memDb({ predictions: [{ id: "p1", fightId: "f1", status: "pending" }] });
    const tx = new BatchTransaction(reader(db), "local");
    await tx.insert("predictions", { id: "p2", fightId: "f1", status: "pending" } as never);
    await tx.update("predictions", "p1", { status: "correct" } as never);
    expect((await tx.list("predictions", { fightId: "f1" } as never)).map((p) => [p.id, p.status])).toEqual([
      ["p1", "correct"],
      ["p2", "pending"],
    ]);
    expect(await tx.list("predictions", { status: "pending" } as never)).toHaveLength(1);
    await tx.remove("predictions", "p2");
    expect(await tx.get("predictions", "p2")).toBeNull();
    expect(db.predictions).toEqual([{ id: "p1", fightId: "f1", status: "pending" }]); // base intacta
    expect(tx.ops.map((o) => o.op)).toEqual(["insert", "update", "delete"]);
  });

  it("linha alterada que passa a combinar com o filtro aparece no list", async () => {
    const db = memDb({ bets: [{ id: "b1", status: "open" }] });
    const tx = new BatchTransaction(reader(db), "local");
    await tx.update("bets", "b1", { status: "won" } as never);
    expect(await tx.list("bets", { status: "won" } as never)).toHaveLength(1);
    expect(await tx.list("bets", { status: "open" } as never)).toHaveLength(0);
  });

  it("atualizar registro inexistente lança erro", async () => {
    const tx = new BatchTransaction(reader(memDb()), "local");
    await expect(tx.update("bets", "nao-existe", { status: "won" } as never)).rejects.toThrow(/não encontrado/);
  });
});

describe("applyBatchToMemory — mesma semântica da função SQL", () => {
  it("tudo ou nada: erro em qualquer operação não altera o banco original", () => {
    const db = memDb({ fight_results: [{ id: "r1", fightId: "f1" }] });
    expect(() =>
      applyBatchToMemory(db, [
        { op: "insert", table: "fighters", row: { id: "x1", name: "X" } },
        { op: "insert", table: "fight_results", row: { id: "r2", fightId: "f1" } }, // viola unicidade
      ]),
    ).toThrow(/Valor duplicado em fight_results.fightId/);
    expect(db.fighters).toEqual([]);
  });

  it("chave primária duplicada é recusada", () => {
    const db = memDb({ fighters: [{ id: "x1" }] });
    expect(() => applyBatchToMemory(db, [{ op: "insert", table: "fighters", row: { id: "x1" } }])).toThrow(/Registro duplicado/);
  });

  it("slug de organização é único também na atualização", () => {
    const db = memDb({ organizations: [{ id: "o1", slug: "ufc" }, { id: "o2", slug: "pfl" }] });
    expect(() => applyBatchToMemory(db, [{ op: "update", table: "organizations", id: "o2", patch: { slug: "ufc" } }])).toThrow(/slug/);
  });

  it("aplica inserção, atualização e exclusão em ordem", () => {
    const next = applyBatchToMemory(memDb({ bets: [{ id: "b1", status: "open" }] }), [
      { op: "update", table: "bets", id: "b1", patch: { status: "won" } },
      { op: "insert", table: "bets", row: { id: "b2", status: "open" } },
      { op: "delete", table: "bets", id: "b1" },
    ]);
    expect(next.bets).toEqual([{ id: "b2", status: "open" }]);
  });
});
