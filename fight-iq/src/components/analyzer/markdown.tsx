import { Fragment, type ReactNode } from "react";

/** Renderizador Markdown mínimo e seguro (sem HTML bruto) para o texto da IA. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[FATO\]|\[INTERPRETAÇÃO\])/g);
  return parts.map((p, i) => {
    if (p === "[FATO]") return <span key={i} className="mr-1 rounded bg-emerald-500/15 px-1 py-px text-[10px] font-bold text-emerald-300">FATO</span>;
    if (p === "[INTERPRETAÇÃO]") return <span key={i} className="mr-1 rounded bg-sky-500/15 px-1 py-px text-[10px] font-bold text-sky-300">INTERPRETAÇÃO</span>;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (li) return void list.push(li[1]);
    flush();
    if (!line.trim()) return;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push(
        <h3 key={idx} className="mt-5 mb-1.5 border-l-2 border-blood-500 pl-2 text-sm font-bold tracking-wide text-white uppercase first:mt-0">
          {h[2]}
        </h3>,
      );
      return;
    }
    out.push(
      <p key={idx} className="my-1.5">
        {inline(line)}
      </p>,
    );
  });
  flush();
  return <div className="text-sm leading-relaxed text-ink-200">{out}</div>;
}
