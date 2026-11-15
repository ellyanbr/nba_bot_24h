import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { buildDemoDataset } from "@/lib/data/demo-seed";
import type { BatchOp } from "@/lib/data/store";
import { batchToSql, fromDb } from "@/lib/data/supabase-store";
import { TABLES, type TableName } from "@/lib/domain/types";
import { MIGRATIONS_DIR, connectTestDb, migrationFiles, resetAndMigrate, selectJson } from "./helpers";

let db: Client;

const ins = (table: TableName, rows: object[]): BatchOp[] => rows.map((row) => ({ op: "insert", table, row: row as Record<string, unknown> }));
const apply = (ops: BatchOp[], role?: string) =>
  db.query(`${role ? `set local role ${role}; ` : ""}select fightiq_apply_batch($1::jsonb) as n`, [JSON.stringify(batchToSql(ops))]);

/** Executa dentro de uma transação descartada (para testar permissões sem deixar estado). */
async function asRole<T>(role: string, sql: string, params: unknown[] = []): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${role}`);
    const r = await db.query(sql, params);
    return r.rows as T;
  } finally {
    await db.query("rollback");
  }
}

const now = new Date().toISOString();
const meta = { createdAt: now, updatedAt: now };

beforeAll(async () => {
  db = await connectTestDb();
  await resetAndMigrate(db);
});
afterAll(async () => {
  await db?.end();
});

describe("migrações 0001–0005", () => {
  it("executam de novo sem erro (idempotentes)", async () => {
    for (const f of migrationFiles()) await db.query(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
  });

  it("criam todas as tabelas da aplicação com RLS ativado", async () => {
    const { rows } = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public'");
    expect(rows.map((r) => r.tablename).sort()).toEqual([...TABLES].sort());
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
  });

  it("0003 cria a organização UFC (dados institucionais)", async () => {
    const [ufc] = await selectJson(db, "organizations", "id = $1", ["org-ufc"]);
    expect(ufc).toMatchObject({ name: "UFC", slug: "ufc", is_demo: false, source_id: "source-manual-institucional" });
  });
});

describe("fightiq_apply_batch: mapeamento das entidades da aplicação", () => {
  it("grava o conjunto de demonstração completo e lê de volta no mesmo formato da aplicação", async () => {
    const demo = buildDemoDataset();
    // 0003 já criou a fonte institucional e o UFC: o lote leva só o que falta (como o app faz).
    const ops = TABLES.flatMap((t) =>
      ins(t, ((demo[t] ?? []) as { id: string }[]).filter((r) => !["org-ufc", "source-manual-institucional"].includes(r.id))),
    );
    const { rows } = await apply(ops);
    expect(rows[0].n).toBe(ops.length);

    for (const t of ["fighters", "fighter_statistics", "events", "fights", "fight_results"] as const) {
      const original = (demo[t] ?? []) as unknown as Record<string, unknown>[];
      const stored = (await selectJson(db, t, "is_demo")).map((r) => fromDb<Record<string, unknown>>(r));
      expect(stored, t).toHaveLength(original.length);
      for (const o of original) {
        const s = stored.find((x) => x.id === o.id)!;
        for (const [k, v] of Object.entries(o)) {
          if (k === "createdAt" || k === "updatedAt") expect(Date.parse(s[k] as string), `${t}.${k}`).toBe(Date.parse(v as string));
          else expect(s[k], `${t}.${k}`).toEqual(v);
        }
      }
    }
  });

  it("grava análise, odds, previsão com probabilidades e aposta numa única transação", async () => {
    const ops: BatchOp[] = [
      ...ins("fight_analyses", [{ id: "an-1", fightId: "demo-b-07", fighterAId: "demo-f-01", fighterBId: "demo-f-04", title: "Teste", factors: [{ factorKey: "striking", edge: "A", basis: "fato", notes: "x" }], pathsToVictoryA: "a", pathsToVictoryB: "b", argumentsA: "", argumentsB: "", vulnerabilitiesA: "", vulnerabilitiesB: "", morePaths: "A", summary: "s", aiOutput: null, dataSnapshot: { referenceDate: "2026-12-06" }, containsDemoData: true, ...meta }]),
      ...ins("odds_snapshots", [{ id: "od-1", analysisId: "an-1", fightId: "demo-b-07", fighterAId: "demo-f-01", fighterBId: "demo-f-04", bookmaker: "Casa", oddsA: 1.85, oddsB: 2.05, oddsDraw: null, capturedAt: now, containsDemoData: true, ...meta }]),
      ...ins("predictions", [{ id: "pr-1", analysisId: "an-1", fightId: "demo-b-07", fighterAId: "demo-f-01", fighterBId: "demo-f-04", pickFighterId: "demo-f-01", method: "KO/TKO", round: 2, probabilityA: 62.5, probabilityB: 37.5, probabilityDraw: 0, confidence: 25, notes: null, status: "pending", resolution: null, voidReason: null, winnerCorrect: null, methodCorrect: null, roundCorrect: null, actualWinnerId: null, actualMethod: null, actualRound: null, resolvedAt: null, containsDemoData: true, ...meta }]),
      ...ins("bets", [{ id: "bt-1", predictionId: "pr-1", decimalOdds: 1.85, stake: 10, bookmaker: "Casa", market: "2way", status: "open", ...meta }]),
    ];
    await apply(ops);
    const [pred] = (await selectJson(db, "predictions", "id = 'pr-1'")).map((r) => fromDb<Record<string, unknown>>(r));
    expect(pred).toMatchObject({ probabilityA: 62.5, probabilityB: 37.5, method: "KO/TKO", voidReason: null, round: 2 });
    const [an] = (await selectJson(db, "fight_analyses", "id = 'an-1'")).map((r) => fromDb<Record<string, unknown>>(r));
    expect(an.factors).toEqual([{ factorKey: "striking", edge: "A", basis: "fato", notes: "x" }]); // jsonb mantém camelCase interno
    const [odds] = (await selectJson(db, "odds_snapshots", "id = 'od-1'")).map((r) => fromDb<Record<string, unknown>>(r));
    expect(odds).toMatchObject({ oddsA: 1.85, oddsB: 2.05, oddsDraw: null });
  });

  it("atualização parcial altera só as colunas enviadas e o trigger renova updated_at", async () => {
    const [before] = await selectJson(db, "predictions", "id = 'pr-1'");
    await new Promise((r) => setTimeout(r, 20));
    await apply([{ op: "update", table: "predictions", id: "pr-1", patch: { status: "void", voidReason: "cancelled", resolution: "auto" } }]);
    const [after] = await selectJson(db, "predictions", "id = 'pr-1'");
    expect(after).toMatchObject({ status: "void", void_reason: "cancelled", method: "KO/TKO", probability_a: 62.5 });
    expect(Date.parse(after.updated_at as string)).toBeGreaterThan(Date.parse(before.updated_at as string));
  });
});

describe("fightiq_apply_batch: tudo ou nada", () => {
  const count = async (table: string, where: string) => Number((await db.query(`select count(*) from ${table} where ${where}`)).rows[0].count);

  it("erro na última operação desfaz as anteriores (violação de chave estrangeira)", async () => {
    const ops: BatchOp[] = [
      ...ins("data_sources", [{ id: "rb-src", name: "Rollback", kind: "manual", url: null, description: null, retrievedAt: null, isDemo: false, ...meta }]),
      ...ins("fighters", [{ id: "rb-f1", organizationId: "org-inexistente", name: "X", nickname: null, nationality: null, birthDate: null, heightCm: null, reachCm: null, stance: null, weightClass: null, team: null, wins: 0, losses: 0, draws: 0, noContests: 0, winsByKo: null, winsBySub: null, winsByDec: null, active: true, notes: null, sourceId: "rb-src", isDemo: false, ...meta }]),
    ];
    await expect(apply(ops)).rejects.toThrow(/foreign key/);
    expect(await count("data_sources", "id = 'rb-src'")).toBe(0);
  });

  it("atualizar registro inexistente é erro e nada é gravado", async () => {
    await expect(
      apply([
        { op: "update", table: "predictions", id: "pr-1", patch: { notes: "não deve ficar" } },
        { op: "update", table: "predictions", id: "nao-existe", patch: { notes: "x" } },
      ]),
    ).rejects.toThrow(/registro não encontrado/);
    expect((await selectJson(db, "predictions", "id = 'pr-1'"))[0].notes).toBeNull();
  });

  it("coluna desconhecida e tabela não permitida são recusadas", async () => {
    await expect(apply([{ op: "update", table: "predictions", id: "pr-1", patch: { campoErrado: 1 } }])).rejects.toThrow(/coluna\(s\) inexistente\(s\)/);
    await expect(db.query(`select fightiq_apply_batch('[{"op":"delete","table":"pg_authid","id":"x"}]'::jsonb)`)).rejects.toThrow(/tabela não permitida/);
  });

  it("resultado duplicado para a mesma luta é recusado (unicidade)", async () => {
    await expect(
      apply(ins("fight_results", [{ id: "dup-r", fightId: "demo-b-01", winnerId: "demo-f-06", method: "KO/TKO", round: 1, time: "1:00", details: null, sourceId: "demo-source", isDemo: true, ...meta }])),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("restrições de domínio (0004/0005)", () => {
  const result = (over: object) => ins("fight_results", [{ id: `r-${Math.random()}`, fightId: "demo-b-08", winnerId: "demo-f-07", method: "KO/TKO", round: 1, time: null, details: null, sourceId: "demo-source", isDemo: true, ...meta, ...over }]);

  it("vitória exige vencedor; empate, NC e resultado anulado não têm vencedor", async () => {
    await expect(apply(result({ winnerId: null }))).rejects.toThrow(/fight_results_winner_check/);
    await expect(apply(result({ method: "Empate" }))).rejects.toThrow(/fight_results_winner_check/);
    await expect(apply(result({ method: "Método inventado" }))).rejects.toThrow(/fight_results_method_check/);
    await db.query("begin");
    await apply(result({ method: "Resultado anulado", winnerId: null, round: 3 }));
    await db.query("rollback");
  });

  it("previsão anulada exige motivo, e motivo só existe em previsão anulada", async () => {
    await expect(apply([{ op: "update", table: "predictions", id: "pr-1", patch: { status: "void", voidReason: null } }])).rejects.toThrow(/predictions_void_consistency_check/);
    await expect(apply([{ op: "update", table: "predictions", id: "pr-1", patch: { status: "pending", voidReason: "draw" } }])).rejects.toThrow(/predictions_void_consistency_check/);
  });

  it("probabilidades precisam somar 100", async () => {
    await expect(apply([{ op: "update", table: "predictions", id: "pr-1", patch: { probabilityA: 60, probabilityB: 30, probabilityDraw: 0 } }])).rejects.toThrow(/predictions_probabilities_check/);
  });

  it("mercado da aposta é 2way ou 3way", async () => {
    await expect(apply([{ op: "update", table: "bets", id: "bt-1", patch: { market: "4way" } }])).rejects.toThrow(/bets_market_check/);
  });
});

describe("permissões (papéis do Supabase)", () => {
  it("anon e authenticated não leem nem gravam nas tabelas", async () => {
    for (const role of ["anon", "authenticated"]) {
      await expect(asRole(role, "select * from fighters limit 1")).rejects.toThrow(/permission denied/);
      await expect(asRole(role, "delete from predictions")).rejects.toThrow(/permission denied/);
    }
  });

  it("anon e authenticated não executam a função de transação", async () => {
    for (const role of ["anon", "authenticated"]) {
      await expect(asRole(role, "select fightiq_apply_batch('[]'::jsonb)")).rejects.toThrow(/permission denied/);
    }
  });

  it("service_role (usada só no servidor) lê e grava via função de transação", async () => {
    const rows = await asRole<{ n: number }[]>("service_role", "select count(*)::int as n from fighters");
    expect(rows[0].n).toBeGreaterThan(0);
    const r = await asRole<{ n: number }[]>("service_role", `select fightiq_apply_batch($1::jsonb) as n`, [
      JSON.stringify(batchToSql([{ op: "update", table: "predictions", id: "pr-1", patch: { notes: "via service_role" } }])),
    ]);
    expect(r[0].n).toBe(1);
  });
});
