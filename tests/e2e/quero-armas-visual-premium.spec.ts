import { test } from "@playwright/test";
import { waitForStable, detectAdminTerm, isBlankPage } from "./utils/humanNavigation";
import { recordAudit } from "./utils/auditReporter";

const VISUAL_ROUTES = [
  "/",
  "/servicos",
  "/descobrir-meu-caminho",
  "/cadastro",
  "/area-do-cliente/login",
  "/area-do-cliente",
  "/dashboard",
  "/clientes",
  "/auditoria",
];

for (const route of VISUAL_ROUTES) {
  test(`visual premium — ${route}`, async ({ page }, info) => {
    await page.goto(route);
    await waitForStable(page, 12_000);
    if (await isBlankPage(page)) {
      recordAudit({
        category: "visual",
        severity: "critical",
        route,
        message: `Tela branca em ${info.project.name}.`,
      });
      return;
    }

    const viewport = page.viewportSize();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth - clientWidth > 2) {
      recordAudit({
        category: "visual",
        severity: "warn",
        route,
        message: `Overflow horizontal em ${info.project.name} (${scrollWidth}px > ${clientWidth}px).`,
        expected: "Sem scroll horizontal em desktop e mobile.",
        recommendation: "Revisar containers/min-width — usar overflow-x-hidden no shell.",
      });
    }

    // Botões/links principais sem texto acessível
    const namelessButtons = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button, a"));
      return els.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) return false;
        const txt = (el.textContent || "").trim();
        const aria = el.getAttribute("aria-label") || "";
        return txt.length === 0 && aria.length === 0;
      }).length;
    });
    if (namelessButtons > 3) {
      recordAudit({
        category: "visual",
        severity: "warn",
        route,
        message: `${namelessButtons} botões/links sem rótulo acessível.`,
        recommendation: "Adicionar aria-label ou texto visível para CTAs.",
      });
    }

    const adminTerm = await detectAdminTerm(page);
    if (adminTerm) {
      recordAudit({
        category: "terminology",
        severity: "warn",
        route,
        message: `Termo "${adminTerm}" presente na UI (${info.project.name}).`,
        found: adminTerm,
        recommendation: 'Trocar por "Equipe Quero Armas" / "Área da Equipe".',
      });
    }

    // Loader infinito
    const loaderVisible = await page
      .locator('[role="progressbar"], .animate-spin, [aria-busy="true"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (loaderVisible) {
      recordAudit({
        category: "visual",
        severity: "error",
        route,
        message: `Loader segue visível após estabilização (${info.project.name}).`,
        recommendation: "Garantir fallback/empty state quando a query falha ou demora.",
      });
    }

    recordAudit({
      category: "visual",
      severity: "ok",
      route,
      message: `Auditoria visual ${info.project.name} concluída (viewport ${viewport?.width}x${viewport?.height}).`,
    });
  });
}