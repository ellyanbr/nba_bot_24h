import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta. Sobem o app em produção numa porta própria, com um banco
 * JSON temporário (recriado a cada execução, a partir dos dados de DEMONSTRAÇÃO).
 * Pré-requisito: `npm run build`. Navegador: `npx playwright install chromium` na primeira vez
 * (ou defina PW_CHROMIUM_PATH para usar um Chromium já instalado).
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
export const E2E_DB = "test-results/e2e-db.json";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // os testes compartilham o mesmo banco
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile/ },
  ],
  webServer: {
    command: `node tests/e2e/start-server.mjs`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), LOCAL_DB_PATH: E2E_DB },
  },
});
