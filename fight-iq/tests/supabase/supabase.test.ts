/**
 * Persistência, operações CRUD, transações e permissões num projeto Supabase real.
 *
 * Como executar (depois de aplicar as migrações 0001–0005 no projeto):
 *   FIGHTIQ_SUPABASE_TEST=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npm run test:supabase
 *
 * Não destrutivo: usa ids com o prefixo "zz-teste-<aleatório>" e os remove ao final.
 * As chaves são lidas apenas do ambiente do terminal; nunca vão para o navegador.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BATCH_FUNCTION, SupabaseStore } from "@/lib/data/supabase-store";
import type { DataSource, Fighter, Organization } from "@/lib/domain/types";
import { uuidV4 } from "@/lib/utils";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;
const enabled = process.env.FIGHTIQ_SUPABASE_TEST === "1" && Boolean(URL && SERVICE);

const P = `zz-teste-${uuidV4().slice(0, 8)}`;
const now = new Date().toISOString();
const source = (id: string): DataSource => ({ id, name: `${P} fonte`, kind: "manual", url: null, description: "teste automatizado", retrievedAt: null, isDemo: false, createdAt: now, updatedAt: now });
const org = (id: string, sourceId: string): Organization => ({ id, name: `${P} org`, slug: id, country: null, website: null, sourceId, isDemo: false, createdAt: now, updatedAt: now });
const fighter = (id: string, organizationId: string | null, sourceId: string): Fighter => ({
  id, organizationId, name: `${P} atleta`, nickname: null, nationality: null, birthDate: "1995-01-15", heightCm: 180.5, reachCm: 185, stance: "Ortodoxo",
  weightClass: "Peso Leve", team: null, wins: 10, losses: 2, draws: 0, noContests: 0, winsByKo: 5, winsBySub: 2, winsByDec: 3, active: true, notes: null,
  sourceId, isDemo: false, createdAt: now, updatedAt: now,
});

describe.skipIf(!enabled)("Supabase real", () => {
  let store: SupabaseStore;

  beforeAll(() => {
    store = new SupabaseStore(URL!, SERVICE!);
  });

  afterAll(async () => {
    if (!store) return;
    // Limpeza: remove tudo o que este teste criou (ordem compatível com as FKs).
    for (const t of ["fighters", "organizations", "data_sources"] as const) {
      for (const r of await store.list(t)) if ((r as { id: string }).id.startsWith(P)) await store.remove(t, (r as { id: string }).id);
    }
  });

  it("conecta e encontra o esquema migrado (organização UFC da 0003)", async () => {
    expect((await store.get("organizations", "org-ufc"))?.name).toBe("UFC");
  });

  it("a função de transação da 0005 existe e está acessível à service role", async () => {
    const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc(BATCH_FUNCTION, { ops: [] });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it("CRUD: cria, lê (tipos preservados), atualiza, filtra e exclui", async () => {
    const s = await store.insert("data_sources", source(`${P}-s1`));
    expect(s.id).toBe(`${P}-s1`);
    const f = await store.insert("fighters", fighter(`${P}-f1`, null, s.id));
    expect(f).toMatchObject({ heightCm: 180.5, birthDate: "1995-01-15", wins: 10, active: true });

    const upd = await store.update("fighters", f.id, { wins: 11, nickname: "Teste" });
    expect(upd).toMatchObject({ wins: 11, nickname: "Teste" });
    expect(Date.parse(upd.updatedAt)).toBeGreaterThanOrEqual(Date.parse(f.updatedAt)); // trigger da 0005

    const byFilter = await store.list("fighters", { sourceId: s.id });
    expect(byFilter.map((x) => x.id)).toEqual([f.id]);

    await store.remove("fighters", f.id);
    expect(await store.get("fighters", f.id)).toBeNull();
  });

  it("persistência: outro cliente (nova conexão) lê o que foi gravado", async () => {
    await store.insert("data_sources", source(`${P}-s2`));
    const other = new SupabaseStore(URL!, SERVICE!);
    expect((await other.get("data_sources", `${P}-s2`))?.name).toBe(`${P} fonte`);
  });

  it("transação: grava várias tabelas juntas", async () => {
    await store.atomic(async (tx) => {
      await tx.insert("data_sources", source(`${P}-s3`));
      await tx.insert("organizations", org(`${P}-o3`, `${P}-s3`));
      await tx.insert("fighters", fighter(`${P}-f3`, `${P}-o3`, `${P}-s3`));
    });
    expect(await store.get("fighters", `${P}-f3`)).not.toBeNull();
  });

  it("transação: erro na última operação desfaz as anteriores (rollback)", async () => {
    await expect(
      store.atomic(async (tx) => {
        await tx.insert("data_sources", source(`${P}-s4`));
        await tx.insert("fighters", fighter(`${P}-f4`, "organizacao-inexistente", `${P}-s4`)); // viola FK
      }),
    ).rejects.toThrow(/transação não aplicada/);
    expect(await store.get("data_sources", `${P}-s4`)).toBeNull();
  });

  it("restrições do banco valem também pela API (slug único)", async () => {
    await expect(store.insert("organizations", { ...org(`${P}-o5`, `${P}-s3`), slug: "ufc" })).rejects.toThrow(/duplicate key|unique/i);
  });

  describe.skipIf(!ANON)("chave pública (anon) — o que o navegador poderia usar", () => {
    const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } });

    it("não lê nenhuma tabela", async () => {
      for (const t of ["fighters", "predictions", "data_sources"]) {
        const { data, error } = await anon().from(t).select("*").limit(1);
        expect(error?.message ?? "", t).toMatch(/permission denied/i);
        expect(data).toBeNull();
      }
    });

    it("não grava nem executa a função de transação", async () => {
      const ins = await anon().from("data_sources").insert({ id: `${P}-anon`, name: "x", kind: "manual" });
      expect(ins.error?.message ?? "").toMatch(/permission denied/i);
      const rpc = await anon().rpc(BATCH_FUNCTION, { ops: [] });
      expect(rpc.error?.message ?? "").toMatch(/permission denied/i);
    });
  });
});

describe.skipIf(enabled)("Supabase real (não configurado)", () => {
  it("defina FIGHTIQ_SUPABASE_TEST=1, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para executar", () => {
    expect(enabled).toBe(false);
  });
});
