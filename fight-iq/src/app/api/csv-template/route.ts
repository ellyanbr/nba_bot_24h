import { CSV_TEMPLATES } from "@/lib/domain/csv-templates";

export function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "fighters";
  const t = CSV_TEMPLATES[tipo];
  if (!t) return new Response("Tipo inválido", { status: 400 });
  const body = [t.columns.map((c) => c.name).join(","), ...t.example].join("\n") + "\n";
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t.filename}"`,
    },
  });
}
