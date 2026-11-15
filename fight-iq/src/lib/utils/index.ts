export function newId(): string {
  return crypto.randomUUID();
}

export const nowIso = () => new Date().toISOString();

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ageAt(birthDate: string | null, at: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  const m = at.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86_400_000);
}

export function formatDate(date: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return "—";
  const d = date.length === 10 ? new Date(`${date}T12:00:00Z`) : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", ...opts });
}

export function formatDateTime(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function recordString(f: { wins: number; losses: number; draws: number; noContests?: number }) {
  return `${f.wins}-${f.losses}-${f.draws}${f.noContests ? ` (${f.noContests} NC)` : ""}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Probabilidade implícita (%) de odds decimais, sem remoção de margem. */
export function impliedProbability(decimalOdds: number): number | null {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return null;
  return 100 / decimalOdds;
}

export function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
