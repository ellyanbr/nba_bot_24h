import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { LocalJsonStore as LocalJsonStoreType } from "@/lib/data/local-store";

// O caminho do arquivo é lido ao carregar o módulo: define-se antes do import dinâmico.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fightiq-local-"));
const file = path.join(dir, "db.json");
let store: LocalJsonStoreType;

beforeAll(async () => {
  process.env.LOCAL_DB_PATH = file;
  const { LocalJsonStore } = await import("@/lib/data/local-store");
  store = new LocalJsonStore();
  await store.list("fighters"); // cria o arquivo com a demonstração
});

const readFile = () => fs.readFileSync(file, "utf8");

describe("LocalJsonStore.atomic", () => {
  it("erro dentro da transação não grava nada (arquivo e memória intactos)", async () => {
    const before = readFile();
    await expect(
      store.atomic(async (tx) => {
        await tx.update("fighters", "demo-f-01", { nickname: "NÃO DEVE FICAR" });
        await tx.insert("data_sources", { id: "tmp-src", name: "x", kind: "manual", url: null, description: null, retrievedAt: null, isDemo: false, createdAt: "", updatedAt: "" });
        throw new Error("falha simulada no meio da operação");
      }),
    ).rejects.toThrow("falha simulada");
    expect(readFile()).toBe(before);
    expect((await store.get("fighters", "demo-f-01"))?.nickname).toBe("Martelo");
    expect(await store.get("data_sources", "tmp-src")).toBeNull();
  });

  it("violação de unicidade (2º resultado para a mesma luta) desfaz o lote inteiro", async () => {
    const before = readFile();
    await expect(
      store.atomic(async (tx) => {
        await tx.update("fights", "demo-b-01", { boutOrder: 42 });
        await tx.insert("fight_results", { id: "dup", fightId: "demo-b-01", winnerId: "demo-f-01", method: "KO/TKO", round: 1, time: null, details: null, sourceId: "demo-source", isDemo: true, createdAt: "", updatedAt: "" });
      }),
    ).rejects.toThrow(/Valor duplicado em fight_results.fightId/);
    expect(readFile()).toBe(before);
    expect((await store.get("fights", "demo-b-01"))?.boutOrder).toBe(1);
  });

  it("sucesso grava tudo de uma vez e persiste no arquivo", async () => {
    await store.atomic(async (tx) => {
      await tx.update("fighters", "demo-f-02", { nickname: "Atualizado" });
      await tx.update("fighters", "demo-f-03", { nickname: "Também" });
    });
    const disk = JSON.parse(readFile());
    expect(disk.fighters.find((f: { id: string }) => f.id === "demo-f-02").nickname).toBe("Atualizado");
    expect(disk.fighters.find((f: { id: string }) => f.id === "demo-f-03").nickname).toBe("Também");
  });

  it("transações concorrentes são serializadas (sem perda de atualização)", async () => {
    await store.update("fighters", "demo-f-04", { wins: 0 });
    await Promise.all(
      Array.from({ length: 25 }, () =>
        store.atomic(async (tx) => {
          const f = await tx.get("fighters", "demo-f-04");
          await tx.update("fighters", "demo-f-04", { wins: f!.wins + 1 });
        }),
      ),
    );
    expect((await store.get("fighters", "demo-f-04"))?.wins).toBe(25);
    expect(JSON.parse(readFile()).fighters.find((f: { id: string }) => f.id === "demo-f-04").wins).toBe(25);
  });
});
