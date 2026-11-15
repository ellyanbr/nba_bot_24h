import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Testes contra um PostgreSQL REAL (npm run test:db).
 * Requer DATABASE_URL apontando para um banco DESCARTÁVEL — o schema public é recriado.
 * Exemplo local: DATABASE_URL=postgres://postgres@127.0.0.1:54329/fightiq_test
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
