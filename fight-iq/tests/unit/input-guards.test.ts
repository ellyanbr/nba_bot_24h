import { describe, expect, it } from "vitest";
import { oversizedArray } from "@/lib/utils/input-guards";

describe("oversizedArray — proteção antes do Zod", () => {
  it("recusa arrays acima do limite sem percorrer os elementos", () => {
    expect(oversizedArray({ factors: new Array(100_000).fill({}) }, { factors: 16 })).toMatch(/excede 16 itens/);
  });
  it("aceita dentro do limite e ignora campos ausentes ou não-array", () => {
    expect(oversizedArray({ factors: new Array(16).fill({}) }, { factors: 16, odds: 20 })).toBeNull();
    expect(oversizedArray({ odds: "x" }, { odds: 20 })).toBeNull();
    expect(oversizedArray(null, { odds: 20 })).toBeNull();
  });
});
