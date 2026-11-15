import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Testes contra um projeto Supabase REAL (npm run test:supabase).
 * Só executam com FIGHTIQ_SUPABASE_TEST=1, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidos.
 * Não são destrutivos: criam e removem apenas registros com o prefixo "zz-teste-".
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/supabase/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
