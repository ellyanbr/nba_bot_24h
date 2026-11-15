export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Valores enviados — devolvidos em caso de erro para não apagar o que o usuário digitou. */
  values?: Record<string, string>;
  /** Muda a cada resposta; usado como `key` para remontar o formulário com os valores. */
  ts?: number;
}

export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  });
  return out;
}

/** Anexa os valores enviados ao estado quando a ação falha. */
export function keepValues<S extends { ok: boolean }>(fd: FormData, state: S): S & { values?: Record<string, string>; ts: number } {
  return state.ok ? { ...state, ts: Date.now() } : { ...state, values: formValues(fd), ts: Date.now() };
}

export const initialActionState: ActionState = { ok: false };

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function zodErrors(issues: { path: (string | number)[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!errors[k]) errors[k] = i.message;
  }
  return errors;
}
