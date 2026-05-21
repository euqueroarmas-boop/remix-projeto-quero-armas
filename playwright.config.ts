import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração Playwright para a auditoria humana do Quero Armas.
 * - Não depende de pacote externo opcional (autocontido).
 * - Trace/screenshot/video preservados em falha.
 * - Sobe automaticamente o dev server local se nenhum baseURL for fornecido.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const useExistingServer = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "test-results/playwright-html" }],
    ["json", { outputFile: "test-results/playwright-report.json" }],
  ],
  outputDir: "test-results/playwright-artifacts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: useExistingServer
    ? undefined
    : {
        command: "npm run dev -- --port 5173 --host",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
