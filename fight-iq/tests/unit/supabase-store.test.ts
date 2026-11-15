import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE, SupabaseStore } from "@/lib/data/supabase-store";
import { TABLES } from "@/lib/domain/types";

/** Cliente falso que imita o limite de linhas por resposta do PostgREST. */
function fakeClient(rows: Record<string, unknown>[], maxRows = PAGE_SIZE) {
  const calls: { match?: Record<string, unknown>; range?: [number, number]; order?: string }[] = [];
  const client = {
    from: () => {
      const call: (typeof calls)[number] = {};
      calls.push(call);
      const builder = {
        select: () => builder,
        match: (m: Record<string, unknown>) => ((call.match = m), builder),
        order: (col: string) => ((call.order = col), builder),
        range: (a: number, b: number) => {
          call.range = [a, b];
          const filtered = rows.filter((r) => Object.entries(call.match ?? {}).every(([k, v]) => r[k] === v));
          const data = filtered.slice(a, Math.min(b + 1, a + maxRows));
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("SupabaseStore.list (S2: paginação)", () => {
  it("lê todas as linhas além do limite de 1000 por resposta", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: String(i).padStart(5, "0"), fighter_id: "f1", stat_key: "slpm", value: i }));
    const { client, calls } = fakeClient(rows);
    const store = new SupabaseStore("http://x", "k", client);
    const out = await store.list("fighter_statistics");
    expect(out).toHaveLength(2500);
    expect(calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(calls.every((c) => c.order === "id")).toBe(true);
  });

  it("converte filtros e colunas entre camelCase e snake_case", async () => {
    const { client, calls } = fakeClient([
      { id: "a", fighter_id: "f1", stat_key: "td_def", as_of: "2026-01-01", is_demo: false },
      { id: "b", fighter_id: "f2", stat_key: "td_def", as_of: "2026-01-01", is_demo: false },
    ]);
    const out = await new SupabaseStore("http://x", "k", client).list("fighter_statistics", { fighterId: "f1" });
    expect(calls[0].match).toEqual({ fighter_id: "f1" });
    expect(out).toEqual([{ id: "a", fighterId: "f1", statKey: "td_def", asOf: "2026-01-01", isDemo: false }]);
  });
});

describe("TABLES (S1: ordem compatível com chaves estrangeiras)", () => {
  it("cada tabela aparece depois das tabelas que ela referencia no esquema SQL", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/0001_init.sql"), "utf8");
    const blocks = [...sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)];
    expect(blocks.length).toBe(TABLES.length);
    for (const [, table, body] of blocks) {
      const refs = [...body.matchAll(/references (\w+)\(/g)].map((m) => m[1]).filter((r) => r !== table);
      for (const ref of refs) {
        expect(TABLES.indexOf(ref as never), `${table} → ${ref}`).toBeLessThan(TABLES.indexOf(table as never));
      }
    }
  });
});
