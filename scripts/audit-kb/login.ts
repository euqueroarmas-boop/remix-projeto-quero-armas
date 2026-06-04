import type { Page } from "playwright";

/**
 * Faz login real na área de Equipe do Quero Armas.
 * Usa as rotas públicas reais — qualquer mudança na UI deve ser refletida aqui.
 */
export async function loginAsTeam(page: Page, baseUrl: string, email: string, password: string) {
  const loginUrl = new URL("/quero-armas/login", baseUrl).toString();
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Aguarda o form de login renderizar.
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20_000 });

  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  // Heurística: se ainda estamos no /login, o login falhou.
  if (page.url().includes("/login")) {
    throw new Error("LOGIN_FAILED: ainda na tela de login após submit (verifique QA_AUDIT_EMAIL/QA_AUDIT_PASSWORD).");
  }
}