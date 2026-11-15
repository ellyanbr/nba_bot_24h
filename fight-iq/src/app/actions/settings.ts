"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { buildDemoDataset, DEMO_SOURCE_ID } from "@/lib/data/demo-seed";
import { TABLES, type DataSource, type Organization, type TableName } from "@/lib/domain/types";
import { SHOW_DEMO_COOKIE } from "@/lib/services/preferences";
import { newId, nowIso } from "@/lib/utils";
import { keepValues, str, zodErrors, type ActionState } from "@/lib/utils/form";

export async function setShowDemo(show: boolean) {
  const store = await cookies();
  store.set(SHOW_DEMO_COOKIE, show ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function loadDemoData(): Promise<ActionState> {
  const store = getStore();
  if (await store.get("data_sources", DEMO_SOURCE_ID)) {
    return { ok: false, message: "Os dados de demonstração já estão carregados." };
  }
  const demo = buildDemoDataset();
  for (const t of TABLES) {
    const rows = (demo[t] ?? []) as never[];
    const existing = new Set((await store.list(t)).map((r) => (r as { id: string }).id));
    const fresh = rows.filter((r) => !existing.has((r as { id: string }).id));
    if (fresh.length) await store.insertMany(t, fresh);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Dados de demonstração carregados." };
}

/** Remove TODOS os registros de demonstração, inclusive análises e previsões que os utilizam. */
export async function removeDemoData(): Promise<ActionState> {
  const store = getStore();
  const demoAnalyses = await store.list("fight_analyses", { containsDemoData: true });
  const demoPreds = await store.list("predictions", { containsDemoData: true });
  for (const p of demoPreds) {
    await store.removeWhere("bets", { predictionId: p.id });
    await store.remove("predictions", p.id);
  }
  for (const a of demoAnalyses) await store.remove("fight_analyses", a.id);
  const order: TableName[] = ["fight_results", "fights", "fighter_statistics", "events", "fighters", "organizations", "data_sources"];
  for (const t of order) await store.removeWhere(t, { isDemo: true } as never);
  revalidatePath("/", "layout");
  return { ok: true, message: "Dados de demonstração removidos." };
}

const SourceSchema = z.object({
  name: z.string({ required_error: "Informe o nome", invalid_type_error: "Informe o nome" }).min(2, "Informe o nome"),
  kind: z.enum(["manual", "csv", "api", "official_site", "other"]),
  url: z.string().url("URL inválida").nullable(),
  description: z.string().nullable(),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable(),
});

export async function createDataSource(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await createDataSourceImpl(prev, fd));
}

async function createDataSourceImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = SourceSchema.safeParse({
    name: str(fd, "name"),
    kind: str(fd, "kind") ?? "manual",
    url: str(fd, "url"),
    description: str(fd, "description"),
    retrievedAt: str(fd, "retrievedAt"),
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos.", errors: zodErrors(parsed.error.issues) };
  const now = nowIso();
  const src: DataSource = { id: newId(), ...parsed.data, isDemo: false, createdAt: now, updatedAt: now };
  await getStore().insert("data_sources", src);
  revalidatePath("/", "layout");
  return { ok: true, message: `Fonte "${src.name}" criada.` };
}

export async function deleteDataSource(id: string): Promise<ActionState> {
  const store = getStore();
  const tables: TableName[] = ["organizations", "fighters", "fighter_statistics", "events", "fights", "fight_results"];
  for (const t of tables) {
    const n = (await store.list(t, { sourceId: id } as never)).length;
    if (n) return { ok: false, message: `Fonte em uso (${n} registro(s) em ${t}). Não pode ser excluída.` };
  }
  await store.remove("data_sources", id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Fonte excluída." };
}

const OrgSchema = z.object({
  name: z.string({ required_error: "Informe o nome", invalid_type_error: "Informe o nome" }).min(2, "Informe o nome"),
  slug: z.string({ required_error: "Informe o identificador", invalid_type_error: "Informe o identificador" }).regex(/^[a-z0-9-]+$/, "Use letras minúsculas, números e hífen"),
  country: z.string().nullable(),
  website: z.string().url("URL inválida").nullable(),
  sourceId: z.string({ required_error: "Informe a fonte", invalid_type_error: "Informe a fonte" }).min(1, "Informe a fonte"),
});

export async function createOrganization(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await createOrganizationImpl(prev, fd));
}

async function createOrganizationImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = OrgSchema.safeParse({
    name: str(fd, "name"),
    slug: str(fd, "slug"),
    country: str(fd, "country"),
    website: str(fd, "website"),
    sourceId: str(fd, "sourceId"),
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos.", errors: zodErrors(parsed.error.issues) };
  const store = getStore();
  if ((await store.list("organizations", { slug: parsed.data.slug })).length) {
    return { ok: false, errors: { slug: "Identificador já utilizado" } };
  }
  const source = await store.get("data_sources", parsed.data.sourceId);
  if (!source) return { ok: false, errors: { sourceId: "Fonte não encontrada" } };
  const now = nowIso();
  const org: Organization = { id: newId(), ...parsed.data, isDemo: source.isDemo, createdAt: now, updatedAt: now };
  await store.insert("organizations", org);
  revalidatePath("/", "layout");
  return { ok: true, message: `Organização "${org.name}" criada.` };
}
