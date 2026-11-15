"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, Swords } from "lucide-react";
import { buttonClasses } from "@/components/ui";

export interface SelectorFighter {
  id: string;
  name: string;
  weightClass: string | null;
  isDemo: boolean;
}
export interface SelectorFight {
  id: string;
  label: string;
  redId: string;
  blueId: string;
}

export function MatchupSelector({ fighters, fights, a, b, fightId }: { fighters: SelectorFighter[]; fights: SelectorFight[]; a?: string; b?: string; fightId?: string }) {
  const router = useRouter();
  const [fa, setFa] = useState(a ?? "");
  const [fb, setFb] = useState(b ?? "");
  const [fight, setFight] = useState(fightId ?? "");

  const go = (na: string, nb: string, nf: string) => {
    const p = new URLSearchParams();
    if (na) p.set("a", na);
    if (nb) p.set("b", nb);
    if (nf) p.set("luta", nf);
    router.push(`/analyzer?${p}`);
  };

  const fighterA = fighters.find((f) => f.id === fa);
  const sorted = (exclude: string) =>
    [...fighters]
      .filter((f) => f.id !== exclude)
      .sort((x, y) => {
        // Prioriza mesma categoria e mesma natureza (demo/real) do atleta A
        if (fighterA && exclude === fa) {
          const sx = Number(x.weightClass === fighterA.weightClass) + Number(x.isDemo === fighterA.isDemo);
          const sy = Number(y.weightClass === fighterA.weightClass) + Number(y.isDemo === fighterA.isDemo);
          if (sx !== sy) return sy - sx;
        }
        return x.name.localeCompare(y.name);
      });

  return (
    <div className="space-y-4">
      {fights.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-300">Carregar de uma luta agendada</span>
          <select
            className="field-input"
            value={fight}
            onChange={(e) => {
              const f = fights.find((x) => x.id === e.target.value);
              setFight(e.target.value);
              if (f) {
                setFa(f.redId);
                setFb(f.blueId);
                go(f.redId, f.blueId, f.id);
              }
            }}
          >
            <option value="">— Selecionar luta —</option>
            {fights.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-300">
            <span className="h-2 w-2 rounded-full bg-blood-500" /> Atleta A
          </span>
          <select className="field-input" value={fa} onChange={(e) => { setFa(e.target.value); setFight(""); }}>
            <option value="">— Selecione —</option>
            {sorted(fb).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.weightClass ? `· ${f.weightClass}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="Inverter atletas" onClick={() => { setFa(fb); setFb(fa); }} className={buttonClasses("ghost")}>
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-300">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Atleta B
          </span>
          <select className="field-input" value={fb} onChange={(e) => { setFb(e.target.value); setFight(""); }}>
            <option value="">— Selecione —</option>
            {sorted(fa).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.weightClass ? `· ${f.weightClass}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!fa || !fb || fa === fb} onClick={() => go(fa, fb, fight)} className={buttonClasses("primary")}>
          <Swords className="h-4 w-4" /> Comparar
        </button>
      </div>
    </div>
  );
}
