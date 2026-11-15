import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/utils/csv";

describe("parseCsv", () => {
  it("lê vírgula, normaliza cabeçalho e remove espaços", () => {
    const { headers, rows } = parseCsv("Name, Wins\nAna , 10\n");
    expect(headers).toEqual(["name", "wins"]);
    expect(rows).toEqual([{ name: "Ana", wins: "10" }]);
  });

  it("detecta ponto e vírgula (Excel em português)", () => {
    expect(parseCsv("name;slpm\nAna;4,2").rows[0]).toEqual({ name: "Ana", slpm: "4,2" });
  });

  it("aceita aspas, aspas escapadas, quebra de linha no campo, BOM e CRLF", () => {
    const { rows } = parseCsv('﻿name,notes\r\n"Silva, J.","diz ""oi""\nem duas linhas"\r\n');
    expect(rows).toEqual([{ name: "Silva, J.", notes: 'diz "oi"\nem duas linhas' }]);
  });

  it("ignora linhas vazias e preenche colunas faltantes", () => {
    expect(parseCsv("a,b\n\n1\n").rows).toEqual([{ a: "1", b: "" }]);
  });

  it("arquivo vazio", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});
