import { test } from "@playwright/test";
import { ALL_ROUTES, RouteSpec } from "./utils/routeDiscovery";
import {
  attachSignals,
  detectAdminTerm,
  isBlankPage,
  waitForStable,
} from "./utils/humanNavigation";
import { recordAudit, resetAudit } from "./utils/auditReporter";

test.describe("Quero Armas — auditoria de rotas", () => {
  test.beforeAll(() => {
    // Não reseta para preservar entradas de outros specs rodando em paralelo.
    // Apenas garante que existe arquivo.
    if (process.env.PLAYWRIGHT_RESET_AUDIT === "1") resetAudit();
  });

  for (const route of ALL_ROUTES) {
    test(`rota ${route.path} (${route.label})`, async ({ page }, testInfo) => {
      const signals = attachSignals(page);
      const start = Date.now();
      let navOk = true;
      try {
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
      } catch (err) {
        navOk = false;
        recordAudit({
          category: "route",
          severity: "critical",
          route: route.path,
          message: `Falha de navegação: ${(err as Error).message}`,
        });
      }
      if (!navOk) return;

      const stable = await waitForStable(page, 12_000);
      const elapsed = Date.now() - start;
      const finalUrl = page.url();
      const blank = await isBlankPage(page);
      const adminTerm = await detectAdminTerm(page);
      const title = await page.title();

      const evidence = await safeScreenshot(page, testInfo, route);
      const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
      const hasUndefined = /\b(undefined|null|nan)\b/.test(bodyText);
      const hasErrorWord = /\berror\b|\berro interno\b/.test(bodyText);

      // Avaliação de severidade
      let severity: "ok" | "warn" | "error" | "critical" = "ok";
      const reasons: string[] = [];

      if (blank) {
        severity = "critical";
        reasons.push("tela branca");
      }
      if (!stable) {
        severity = severity === "critical" ? severity : "error";
        reasons.push("loader não estabilizou em 12s");
      }
      if (signals.pageErrors.length > 0) {
        severity = "critical";
        reasons.push(`pageerror: ${signals.pageErrors[0]}`);
      }
      const criticalConsole = signals.consoleErrors.filter(
        (m) => !/favicon|sourcemap|extension|chrome-extension/i.test(m),
      );
      if (criticalConsole.length > 0) {
        severity = severity === "ok" ? "warn" : severity;
        reasons.push(`${criticalConsole.length} console.error`);
      }
      const importantBad = signals.badResponses.filter(
        (r) => !/auth\/v1|rest\/v1\/.*\.(svg|png|webp)/.test(r.url),
      );
      if (importantBad.length > 0) {
        severity = severity === "ok" ? "warn" : severity;
        reasons.push(`${importantBad.length} requests 4xx/5xx`);
      }
      if (hasUndefined) {
        severity = severity === "ok" ? "warn" : severity;
        reasons.push('texto "undefined/null/NaN" visível');
      }
      if (hasErrorWord && severity === "ok") {
        severity = "warn";
        reasons.push("texto de erro visível");
      }

      recordAudit({
        category: "route",
        severity,
        route: route.path,
        step: route.label,
        message:
          reasons.length === 0
            ? `OK — ${title || "(sem título)"} em ${elapsed}ms`
            : reasons.join("; "),
        expected: "Tela carrega, estabiliza e mostra conteúdo principal.",
        found: `${blank ? "BRANCA" : "renderizada"} | url=${finalUrl} | console=${criticalConsole.length} | net4xx=${importantBad.length}`,
        evidence,
        hint: signals.pageErrors[0] || criticalConsole[0] || importantBad[0]?.url,
      });

      if (adminTerm) {
        recordAudit({
          category: "terminology",
          severity: "warn",
          route: route.path,
          message: `Termo "${adminTerm}" exibido na UI.`,
          found: adminTerm,
          recommendation: 'Substituir por "Equipe Quero Armas" ou "Área da Equipe".',
          evidence,
        });
      }
    });
  }
});

async function safeScreenshot(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  route: RouteSpec,
): Promise<string | undefined> {
  try {
    const file = testInfo.outputPath(
      `route-${route.path.replace(/[^a-z0-9]+/gi, "_")}.png`,
    );
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch {
    return undefined;
  }
}