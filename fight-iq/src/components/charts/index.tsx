import { cn } from "@/lib/utils";
import type { Edge } from "@/lib/domain/types";

/** Barras espelhadas para comparar uma métrica entre dois atletas. */
export function MirrorBar({ label, a, b, unit, better, hint }: { label: string; a: number | null; b: number | null; unit: string; better: Edge; hint?: string }) {
  const max = unit === "%" ? 100 : Math.max(a ?? 0, b ?? 0, 0.0001) * 1.15;
  const pct = (v: number | null) => (v == null ? 0 : Math.min(100, (v / max) * 100));
  const fmt = (v: number | null) => (v == null ? "—" : `${v}${unit === "%" ? "%" : ""}`);
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className={cn("tabular w-14 font-semibold", better === "A" ? "text-white" : "text-ink-300")}>{fmt(a)}</span>
        <span className="truncate px-2 text-center text-[11px] font-medium tracking-wide text-ink-400 uppercase" title={hint}>
          {label}
        </span>
        <span className={cn("tabular w-14 text-right font-semibold", better === "B" ? "text-white" : "text-ink-300")}>{fmt(b)}</span>
      </div>
      <div className="flex h-2 gap-1">
        <div className="flex flex-1 justify-end overflow-hidden rounded-l bg-ink-700">
          <div className={cn("h-full rounded-l", better === "A" ? "bg-blood-500" : "bg-blood-500/40")} style={{ width: `${pct(a)}%` }} />
        </div>
        <div className="flex flex-1 overflow-hidden rounded-r bg-ink-700">
          <div className={cn("h-full rounded-r", better === "B" ? "bg-blue-500" : "bg-blue-500/40")} style={{ width: `${pct(b)}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Anel com distribuição dos métodos de vitória. */
export function MethodDonut({ ko, sub, dec, size = 120 }: { ko: number | null; sub: number | null; dec: number | null; size?: number }) {
  const parts = [
    { label: "KO/TKO", value: ko ?? 0, color: "#e01e2d" },
    { label: "Finalização", value: sub ?? 0, color: "#f59e0b" },
    { label: "Decisão", value: dec ?? 0, color: "#6b7280" },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  if (ko == null && sub == null && dec == null) {
    return <p className="text-xs text-ink-400">Métodos de vitória não informados.</p>;
  }
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2229" strokeWidth="12" />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c;
            const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="w-20 text-ink-300">{p.label}</span>
            <span className="tabular font-semibold text-white">{p.value}</span>
            <span className="tabular text-ink-400">{total ? `${Math.round((p.value / total) * 100)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sequência de resultados (V/D/E/NC). */
export function FormStrip({ outcomes }: { outcomes: string[] }) {
  if (!outcomes.length) return <span className="text-xs text-ink-400">Sem lutas registradas</span>;
  return (
    <div className="flex gap-1">
      {outcomes.map((o, i) => (
        <span
          key={i}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
            o === "V" ? "bg-emerald-500/20 text-emerald-300" : o === "D" ? "bg-blood-600/25 text-blood-300" : "bg-ink-700 text-ink-300",
          )}
        >
          {o}
        </span>
      ))}
    </div>
  );
}

/** Anel de percentual (ex.: taxa de acerto). */
export function RingGauge({ value, label, size = 112 }: { value: number | null; label: string; size?: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2229" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e01e2d" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-xl font-bold text-white">{value == null ? "—" : `${value.toFixed(0)}%`}</span>
        <span className="text-[10px] tracking-wider text-ink-400 uppercase">{label}</span>
      </div>
    </div>
  );
}

/** Barra horizontal simples 0–100. */
export function Meter({ value, tone = "red" }: { value: number | null; tone?: "red" | "blue" | "neutral" }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-ink-700">
      <div className={cn("h-full rounded", tone === "red" ? "bg-blood-500" : tone === "blue" ? "bg-blue-500" : "bg-ink-300")} style={{ width: `${v}%` }} />
    </div>
  );
}
