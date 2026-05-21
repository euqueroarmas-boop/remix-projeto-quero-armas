import { Page, Locator, expect } from "@playwright/test";
import { recordAudit } from "./auditReporter";

const DESTRUCTIVE = [
  "excluir",
  "apagar",
  "remover",
  "deletar",
  "cancelar assinatura",
  "limpar banco",
  "reprovar",
  "arquivar",
  "excluir cliente",
];

export function isDestructive(label: string): boolean {
  const l = label.toLowerCase();
  return DESTRUCTIVE.some((d) => l.includes(d));
}

export async function humanWait(page: Page, reason: string, ms = 600) {
  await page.waitForTimeout(ms);
  // Log discreto para o trace
  await page.evaluate((r) => console.log(`[human] ${r}`), reason).catch(() => {});
}

export async function scrollLikeHuman(page: Page) {
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((s) => {
      const h = document.body.scrollHeight;
      window.scrollTo({ top: (h / 6) * s, behavior: "smooth" });
    }, i);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(200);
}

export async function humanClick(page: Page, locator: Locator, label: string) {
  if (isDestructive(label)) {
    recordAudit({
      category: "journey",
      severity: "info",
      route: page.url(),
      step: `Bloqueado clique destrutivo: ${label}`,
      message: `Auditor recusou clique em ação destrutiva ("${label}").`,
    });
    return false;
  }
  try {
    await locator.first().scrollIntoViewIfNeeded({ timeout: 5000 });
    await locator.first().click({ timeout: 8000 });
    await humanWait(page, `após clicar em "${label}"`, 400);
    return true;
  } catch (err) {
    recordAudit({
      category: "journey",
      severity: "warn",
      route: page.url(),
      step: `Clique falhou: ${label}`,
      message: `Não foi possível clicar em "${label}".`,
      hint: (err as Error).message,
    });
    return false;
  }
}

export async function humanFill(
  page: Page,
  locator: Locator,
  value: string,
  label: string,
) {
  try {
    await locator.first().scrollIntoViewIfNeeded({ timeout: 3000 });
    await locator.first().fill(value, { timeout: 8000 });
    await humanWait(page, `preencheu ${label}`, 150);
    return true;
  } catch (err) {
    recordAudit({
      category: "journey",
      severity: "warn",
      route: page.url(),
      step: `Preencher ${label}`,
      message: `Falha ao preencher "${label}".`,
      hint: (err as Error).message,
    });
    return false;
  }
}

/**
 * Procura por intenção: testa vários textos típicos de CTA e clica no primeiro
 * que estiver visível. Retorna true se clicou.
 */
export async function findAndClickByIntent(
  page: Page,
  intents: string[],
  opts: { exact?: boolean } = {},
): Promise<{ clicked: boolean; label?: string }> {
  for (const intent of intents) {
    if (isDestructive(intent)) continue;
    const candidates = [
      page.getByRole("button", { name: new RegExp(intent, "i") }),
      page.getByRole("link", { name: new RegExp(intent, "i") }),
      page.locator(`text=/${intent}/i`),
    ];
    for (const cand of candidates) {
      const count = await cand.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 5); i++) {
        const el = cand.nth(i);
        if (await el.isVisible().catch(() => false)) {
          const ok = await humanClick(page, el, intent);
          if (ok) return { clicked: true, label: intent };
        }
      }
    }
  }
  return { clicked: false };
}

/**
 * Aguarda a página "estabilizar" — sem loader visível por X ms consecutivos.
 * Retorna true se estabilizou dentro do timeout.
 */
export async function waitForStable(page: Page, timeoutMs = 12000): Promise<boolean> {
  const start = Date.now();
  const loaderSelector =
    '[role="progressbar"], .animate-spin, [data-loading="true"], [aria-busy="true"]';
  while (Date.now() - start < timeoutMs) {
    const hasLoader = await page
      .locator(loaderSelector)
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasLoader) {
      await page.waitForTimeout(400);
      const stillLoader = await page
        .locator(loaderSelector)
        .first()
        .isVisible()
        .catch(() => false);
      if (!stillLoader) return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

export interface PageSignals {
  consoleErrors: string[];
  pageErrors: string[];
  badResponses: { url: string; status: number }[];
}

export function attachSignals(page: Page): PageSignals {
  const signals: PageSignals = {
    consoleErrors: [],
    pageErrors: [],
    badResponses: [],
  };
  page.on("console", (msg) => {
    if (msg.type() === "error") signals.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => signals.pageErrors.push(err.message));
  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !/favicon|hot-update|\.map$/.test(url)) {
      signals.badResponses.push({ url, status });
    }
  });
  return signals;
}

export async function isBlankPage(page: Page): Promise<boolean> {
  const text = (await page.locator("body").innerText().catch(() => "")).trim();
  return text.length < 5;
}

export async function detectAdminTerm(page: Page): Promise<string | null> {
  const txt = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  // Aceita "administrador judicial" e termos legais; flagra "admin", "painel admin", "área admin".
  const match = txt.match(/\b(admin|painel admin|área admin|admin panel)\b/);
  return match ? match[0] : null;
}