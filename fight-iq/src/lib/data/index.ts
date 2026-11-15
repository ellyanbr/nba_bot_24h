import "server-only";
import type { DataStore } from "./store";
import { LocalJsonStore } from "./local-store";
import { SupabaseStore } from "./supabase-store";

export interface BackendStatus {
  backend: "local" | "supabase";
  configured: boolean;
  message: string;
}

export function getBackendStatus(): BackendStatus {
  const wanted = (process.env.DATA_BACKEND ?? "local").toLowerCase();
  if (wanted === "supabase") {
    const ok = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    return {
      backend: "supabase",
      configured: ok,
      message: ok
        ? "Supabase configurado (PostgreSQL)."
        : "DATA_BACKEND=supabase, mas SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estão definidas.",
    };
  }
  return {
    backend: "local",
    configured: true,
    message: "Armazenamento local em arquivo JSON (data/fightiq.local.json).",
  };
}

const globalForStore = globalThis as unknown as { __fightIqStore?: DataStore };

export function getStore(): DataStore {
  if (globalForStore.__fightIqStore) return globalForStore.__fightIqStore;
  const status = getBackendStatus();
  let store: DataStore;
  if (status.backend === "supabase") {
    if (!status.configured) throw new Error(status.message);
    store = new SupabaseStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  } else {
    store = new LocalJsonStore();
  }
  globalForStore.__fightIqStore = store;
  return store;
}
