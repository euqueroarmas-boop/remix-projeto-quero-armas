import type { Page } from "playwright";
import type { AuditStep } from "./parseSteps.ts";

export type CaptureResult =
  | { ok: true; buffer: Buffer; finalUrl: string }
  | { ok: false; error: string; finalUrl: string };

/**
 * Navega até a rota do passo e tenta capturar screenshot real.
 * NUNCA gera fallback visual. Em caso de erro, retorna { ok:false }.
 */
export async function captureStep(
  page: Page,
  baseUrl: string,
  step: AuditStep,
): Promise<CaptureResult> {
  const target = new URL(step.route, baseUrl).toString();
  try {
    await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });

    // Verifica se a rota não jogou pra 404 / login.
    const url = page.url();
    if (/\/login(\?|$)/.test(url) && !/\/login/.test(step.route)) {
      return { ok: false, error: "ROUTE_REDIRECTED_TO_LOGIN", finalUrl: url };
    }
    if (await page.locator("text=/página não encontrada|404/i").first().isVisible().catch(() => false)) {
      return { ok: false, error: "ROUTE_NOT_FOUND", finalUrl: url };
    }

    if (step.fill) {
      const [sel, value] = step.fill.split("::");
      if (sel && value !== undefined) {
        await page.fill(sel, value, { timeout: 10_000 }).catch(() => null);
      }
    }
    if (step.click) {
      await page.click(step.click, { timeout: 10_000 });
    }
    if (step.wait) {
      await page.waitForSelector(step.wait, { timeout: 15_000 });
    } else {
      // Pequena espera para animações / lazy renders.
      await page.waitForTimeout(500);
    }

    // Validação semântica: pelo menos UM expected_text deve estar visível.
    if (step.expected_text && step.expected_text.length > 0) {
      let matched = 0;
      for (const phrase of step.expected_text) {
        const ok = await page
          .getByText(phrase, { exact: false })
          .first()
          .isVisible({ timeout: 4_000 })
          .catch(() => false);
        if (ok) matched++;
      }
      if (matched === 0) {
        return {
          ok: false,
          error: `EXPECTED_TEXT_NOT_FOUND: nenhum de [${step.expected_text.join(" | ")}] encontrado em ${page.url()}`,
          finalUrl: page.url(),
        };
      }
    }

    const buffer = await page.screenshot({ fullPage: true, type: "png" });
    return { ok: true, buffer, finalUrl: page.url() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      finalUrl: page.url(),
    };
  }
}