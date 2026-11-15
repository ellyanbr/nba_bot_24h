import "server-only";
import { cookies } from "next/headers";

export const SHOW_DEMO_COOKIE = "fiq_show_demo";

/** Preferência do usuário: exibir ou ocultar dados de DEMONSTRAÇÃO (padrão: exibir). */
export async function getShowDemo(): Promise<boolean> {
  const store = await cookies();
  return store.get(SHOW_DEMO_COOKIE)?.value !== "0";
}
