"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, Info, Loader2, Save, ShieldAlert } from "lucide-react";
import { runAIAnalysis, saveAnalysis, type AnalysisDraft } from "@/app/actions/analyses";
import { Badge, Card, CardBody, CardHeader, Field, buttonClasses } from "@/components/ui";
import { runConsistencyChecks } from "@/lib/analysis/checks";
import type { ComparisonResult } from "@/lib/analysis/comparison";
import { RESULT_METHODS, type AIOutput, type Basis, type Edge, type FactorAssessment } from "@/lib/domain/types";
import { cn, impliedProbability } from "@/lib/utils";
import { Markdown } from "./markdown";

interface Props {
  comparison: ComparisonResult;
  fighterA: { id: string; name: string };
  fighterB: { id: string; name: string };
  fightId: string | null;
  scheduledRounds: number;
  ai: { configured: boolean; label: string; message: string };
}

const EDGE_LABEL: Record<Edge, string> = { A: "A", B: "B", even: "Equilíbrio", unknown: "Sem avaliação" };

export function AnalyzerWorkspace({ comparison, fighterA, fighterB, fightId, scheduledRounds, ai }: Props) {
  const router = useRouter();
  const [factors, setFactors] = useState<FactorAssessment[]>(() =>
    comparison.factors.map((f) => ({ factorKey: f.key, edge: "unknown", basis: f.insufficient ? "interpretacao" : "fato", notes: "" })),
  );
  const [text, setText] = useState({
    title: "",
    pathsToVictoryA: "",
    pathsToVictoryB: "",
    argumentsA: "",
    argumentsB: "",
    vulnerabilitiesA: "",
    vulnerabilitiesB: "",
    summary: "",
  });
  const [morePaths, setMorePaths] = useState<Edge>("unknown");
  const [withPrediction, setWithPrediction] = useState(false);
  const [pred, setPred] = useState({ pick: "A" as "A" | "B", method: "Qualquer", round: "", confidence: 60, notes: "", odds: "", bookmaker: "", stake: "" });
  const [aiOutput, setAiOutput] = useState<AIOutput | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiPending, startAi] = useTransition();
  const [savePending, startSave] = useTransition();

  const nameOf = (e: Edge) => (e === "A" ? fighterA.name : e === "B" ? fighterB.name : EDGE_LABEL[e]);
  const setFactor = (key: string, patch: Partial<FactorAssessment>) => setFactors((fs) => fs.map((f) => (f.factorKey === key ? { ...f, ...patch } : f)));
  const odds = pred.odds ? Number(pred.odds.replace(",", ".")) : null;

  const checks = useMemo(
    () =>
      runConsistencyChecks({
        factors,
        morePaths,
        pick: withPrediction ? pred.pick : null,
        confidence: withPrediction ? pred.confidence : null,
        decimalOdds: withPrediction && odds != null && Number.isFinite(odds) ? odds : null,
        pathsA: text.pathsToVictoryA,
        pathsB: text.pathsToVictoryB,
        argumentsA: text.argumentsA,
        argumentsB: text.argumentsB,
      }),
    [factors, morePaths, withPrediction, pred, odds, text],
  );

  const tally = {
    A: factors.filter((f) => f.edge === "A").length,
    B: factors.filter((f) => f.edge === "B").length,
    even: factors.filter((f) => f.edge === "even").length,
    unknown: factors.filter((f) => f.edge === "unknown").length,
  };

  const promptDraft = () => ({
    factors: factors.map((f) => ({
      label: comparison.factors.find((c) => c.key === f.factorKey)?.label ?? f.factorKey,
      edge: nameOf(f.edge),
      basis: f.basis === "fato" ? "fato" : "interpretação",
      notes: f.notes,
    })),
    pathsA: text.pathsToVictoryA,
    pathsB: text.pathsToVictoryB,
    argumentsA: text.argumentsA,
    argumentsB: text.argumentsB,
    vulnerabilitiesA: text.vulnerabilitiesA,
    vulnerabilitiesB: text.vulnerabilitiesB,
    morePaths: nameOf(morePaths),
    summary: text.summary,
  });

  const onRunAI = () => {
    setAiError(null);
    startAi(async () => {
      const res = await runAIAnalysis({ fighterAId: fighterA.id, fighterBId: fighterB.id, fightId, draft: promptDraft() });
      if (res.ok && res.output) setAiOutput(res.output);
      else setAiError(res.message);
    });
  };

  const onSave = () => {
    setSaveMsg(null);
    const draft: AnalysisDraft = {
      fighterAId: fighterA.id,
      fighterBId: fighterB.id,
      fightId,
      ...text,
      factors,
      morePaths,
      aiOutput,
      prediction: withPrediction
        ? {
            pick: pred.pick,
            method: pred.method,
            round: pred.round ? Number(pred.round) : null,
            confidence: pred.confidence,
            notes: pred.notes || null,
            decimalOdds: odds != null && Number.isFinite(odds) ? odds : null,
            bookmaker: pred.bookmaker || null,
            stake: pred.stake ? Number(pred.stake.replace(",", ".")) : null,
          }
        : null,
    };
    startSave(async () => {
      const res = await saveAnalysis(draft);
      setSaveMsg({ ok: res.ok, text: res.message });
      if (res.ok && res.analysisId) router.push(`/historico/analises/${res.analysisId}`);
    });
  };

  const groups = ["Forma", "Técnico", "Físico", "Contexto"];
  const ta = (key: keyof typeof text, label: string, placeholder: string, tone?: "red" | "blue") => (
    <Field label={label}>
      <textarea
        rows={4}
        value={text[key]}
        onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
        placeholder={placeholder}
        className={cn("field-input", tone === "red" && "border-l-2 border-l-blood-500", tone === "blue" && "border-l-2 border-l-blue-500")}
      />
    </Field>
  );

  return (
    <div className="space-y-6">
      {/* FATORES */}
      <Card>
        <CardHeader
          title="Avaliação fator a fator"
          subtitle="Os fatos vêm dos dados cadastrados. A vantagem e a base (fato × interpretação) são decisão sua."
          action={
            <div className="hidden gap-1.5 sm:flex">
              <Badge tone="red">A {tally.A}</Badge>
              <Badge tone="blue">B {tally.B}</Badge>
              <Badge>= {tally.even}</Badge>
              <Badge>? {tally.unknown}</Badge>
            </div>
          }
        />
        <CardBody className="space-y-8">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-blood-400 uppercase">{g}</h3>
              <div className="space-y-3">
                {comparison.factors
                  .filter((f) => f.group === g)
                  .map((f) => {
                    const fa = factors.find((x) => x.factorKey === f.key)!;
                    return (
                      <div key={f.key} className="rounded-lg border border-ink-700 bg-ink-900/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{f.label}</p>
                            <p className="text-xs text-ink-400">{f.guide}</p>
                          </div>
                          {f.insufficient ? (
                            <Badge tone="amber">Dados insuficientes</Badge>
                          ) : f.numericIndicator !== "unknown" ? (
                            <Badge tone={f.numericIndicator === "A" ? "red" : f.numericIndicator === "B" ? "blue" : "neutral"} title="Indicador calculado apenas a partir dos números cadastrados; não é uma conclusão.">
                              Indicador numérico: {nameOf(f.numericIndicator)}
                            </Badge>
                          ) : null}
                        </div>
                        {f.facts.length > 0 ? (
                          <ul className="mt-3 space-y-1 border-l border-ink-600 pl-3 text-xs text-ink-200">
                            {f.facts.map((fact, i) => (
                              <li key={i}>
                                <span className="mr-1 text-[9px] font-bold text-emerald-400">FATO</span>
                                {fact}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-xs text-amber-200/80">Não há dados estruturados para este fator. Se avaliar, registre a fonte nas notas e marque como interpretação quando aplicável.</p>
                        )}
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,240px)_170px_1fr]">
                          <select aria-label={`Vantagem em ${f.label}`} value={fa.edge} onChange={(e) => setFactor(f.key, { edge: e.target.value as Edge })} className="field-input">
                            <option value="unknown">Vantagem: sem avaliação</option>
                            <option value="A">Vantagem: {fighterA.name}</option>
                            <option value="B">Vantagem: {fighterB.name}</option>
                            <option value="even">Equilíbrio</option>
                          </select>
                          <select aria-label={`Base de ${f.label}`} value={fa.basis} onChange={(e) => setFactor(f.key, { basis: e.target.value as Basis })} className="field-input">
                            <option value="fato">Baseado em fato</option>
                            <option value="interpretacao">Interpretação</option>
                          </select>
                          <input value={fa.notes} onChange={(e) => setFactor(f.key, { notes: e.target.value })} placeholder="Justificativa / fonte" className="field-input" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* CAMINHOS / ARGUMENTOS */}
      <Card>
        <CardHeader title="Caminhos para vitória e contrapontos" subtitle="Construa os dois lados — o objetivo é reduzir o viés." />
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ta("pathsToVictoryA", `O que ${fighterA.name} precisa fazer para vencer`, "Ex.: manter distância com o jab, punir entradas de queda…", "red")}
          {ta("pathsToVictoryB", `O que ${fighterB.name} precisa fazer para vencer`, "Ex.: pressionar contra a grade, encadear quedas…", "blue")}
          {ta("argumentsA", `Argumentos a favor de ${fighterA.name}`, "Pontos objetivos que sustentam A", "red")}
          {ta("argumentsB", `Argumentos a favor de ${fighterB.name}`, "Pontos objetivos que sustentam B", "blue")}
          {ta("vulnerabilitiesA", `Vulnerabilidades de ${fighterA.name}`, "Brechas exploráveis", "red")}
          {ta("vulnerabilitiesB", `Vulnerabilidades de ${fighterB.name}`, "Brechas exploráveis", "blue")}
          <Field label="Quem possui mais caminhos para vencer?">
            <select value={morePaths} onChange={(e) => setMorePaths(e.target.value as Edge)} className="field-input">
              <option value="unknown">Ainda não definido</option>
              <option value="A">{fighterA.name}</option>
              <option value="B">{fighterB.name}</option>
              <option value="even">Equilibrado</option>
            </select>
          </Field>
          <Field label="Título da análise (opcional)">
            <input value={text.title} onChange={(e) => setText((t) => ({ ...t, title: e.target.value }))} placeholder={`${fighterA.name} × ${fighterB.name}`} className="field-input" />
          </Field>
          <div className="md:col-span-2">{ta("summary", "Conclusão", "Síntese da leitura técnica do confronto")}</div>
        </CardBody>
      </Card>

      {/* PREVISÃO */}
      <Card>
        <CardHeader
          title="Previsão (opcional)"
          subtitle="Registre sua escolha e confiança para medir a calibração no histórico."
          action={
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" checked={withPrediction} onChange={(e) => setWithPrediction(e.target.checked)} className="h-4 w-4 accent-blood-600" />
              Registrar previsão
            </label>
          }
        />
        {withPrediction && (
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Vencedor previsto">
              <select value={pred.pick} onChange={(e) => setPred((p) => ({ ...p, pick: e.target.value as "A" | "B" }))} className="field-input">
                <option value="A">{fighterA.name}</option>
                <option value="B">{fighterB.name}</option>
              </select>
            </Field>
            <Field label="Método">
              <select value={pred.method} onChange={(e) => setPred((p) => ({ ...p, method: e.target.value }))} className="field-input">
                <option>Qualquer</option>
                {RESULT_METHODS.filter((m) => !["Empate", "Sem resultado", "Outro"].includes(m)).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Round">
              <select value={pred.round} onChange={(e) => setPred((p) => ({ ...p, round: e.target.value }))} className="field-input">
                <option value="">Qualquer</option>
                {Array.from({ length: scheduledRounds }, (_, i) => (
                  <option key={i + 1}>{i + 1}</option>
                ))}
              </select>
            </Field>
            <Field label={`Confiança: ${pred.confidence}%`}>
              <input type="range" min={50} max={100} step={1} value={pred.confidence} onChange={(e) => setPred((p) => ({ ...p, confidence: Number(e.target.value) }))} className="mt-2 w-full accent-blood-600" />
            </Field>
            <Field label="Odds decimais (opcional)" hint={odds && impliedProbability(odds) ? `Prob. implícita: ${impliedProbability(odds)!.toFixed(1)}%` : "Para verificar armadilhas de preço"}>
              <input value={pred.odds} onChange={(e) => setPred((p) => ({ ...p, odds: e.target.value }))} inputMode="decimal" placeholder="1.85" className="field-input" />
            </Field>
            <Field label="Casa (opcional)">
              <input value={pred.bookmaker} onChange={(e) => setPred((p) => ({ ...p, bookmaker: e.target.value }))} className="field-input" />
            </Field>
            <Field label="Valor registrado (opcional)">
              <input value={pred.stake} onChange={(e) => setPred((p) => ({ ...p, stake: e.target.value }))} inputMode="decimal" className="field-input" />
            </Field>
            <Field label="Observações">
              <input value={pred.notes} onChange={(e) => setPred((p) => ({ ...p, notes: e.target.value }))} className="field-input" />
            </Field>
          </CardBody>
        )}
      </Card>

      {/* VERIFICAÇÕES */}
      <Card>
        <CardHeader title="Questionamentos automáticos" subtitle="Regras de consistência explícitas — não é IA." icon={<ShieldAlert className="h-4 w-4" />} />
        <CardBody className="space-y-2">
          {checks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Nenhuma inconsistência detectada pelas regras.
            </p>
          ) : (
            checks.map((c, i) => (
              <div key={i} className={cn("flex gap-2 rounded-md border px-3 py-2 text-sm", c.level === "alerta" ? "border-blood-600/50 bg-blood-600/10 text-blood-300" : c.level === "atencao" ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-ink-600 bg-ink-800 text-ink-200")}>
                {c.level === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                {c.text}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* IA */}
      <Card className={cn(ai.configured && "border-blood-600/30")}>
        <CardHeader title="Análise por IA" subtitle={ai.configured ? `Provedor: ${ai.label}` : "Integração não configurada"} icon={<Bot className="h-4 w-4" />} />
        <CardBody className="space-y-4">
          {!ai.configured ? (
            <div className="rounded-md border border-ink-600 bg-ink-800 p-4 text-sm text-ink-200">
              <p className="font-medium text-white">A análise por IA está indisponível.</p>
              <p className="mt-1 text-ink-300">{ai.message}</p>
              <p className="mt-2 text-ink-300">
                Nenhuma análise simulada é exibida no lugar. Para habilitar gratuitamente com um modelo local, veja{" "}
                <Link href="/configuracoes" className="text-blood-300 underline">
                  Configurações
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-400">
                A IA recebe somente os dados cadastrados (com fontes) e sua análise atual, com instruções para não inventar estatísticas, separar fatos de interpretações e questionar suas escolhas.
              </p>
              <button type="button" onClick={onRunAI} disabled={aiPending} className={buttonClasses("secondary")}>
                {aiPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {aiPending ? "Gerando análise…" : aiOutput ? "Gerar novamente" : "Gerar análise com IA"}
              </button>
            </>
          )}
          {aiError && <p className="rounded-md border border-blood-600/50 bg-blood-600/10 px-3 py-2 text-sm text-blood-300">{aiError}</p>}
          {aiOutput && (
            <div className="rounded-lg border border-ink-600 bg-ink-900 p-4">
              <p className="mb-3 text-[11px] text-ink-400">
                Gerado por {aiOutput.provider} / {aiOutput.model}. Conteúdo gerado por IA pode conter erros — confira com os fatos acima.
              </p>
              <Markdown content={aiOutput.content} />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-ink-600 bg-ink-900/95 p-3 backdrop-blur">
        {saveMsg && <span className={cn("text-sm", saveMsg.ok ? "text-emerald-300" : "text-blood-300")}>{saveMsg.text}</span>}
        <span className="mr-auto hidden text-xs text-ink-400 sm:inline">
          {comparison.containsDemo ? "Esta análise usa dados de DEMONSTRAÇÃO e será marcada como tal." : "Os dados objetivos serão salvos junto com a análise para auditoria."}
        </span>
        <button type="button" onClick={onSave} disabled={savePending} className={buttonClasses("primary")}>
          {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar análise{withPrediction ? " e previsão" : ""}
        </button>
      </div>
    </div>
  );
}
