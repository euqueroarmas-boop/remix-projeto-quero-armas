import { test, expect } from "@playwright/test";
import {
  attachSignals,
  detectAdminTerm,
  findAndClickByIntent,
  humanFill,
  humanWait,
  isBlankPage,
  scrollLikeHuman,
  waitForStable,
} from "./utils/humanNavigation";
import { recordAudit } from "./utils/auditReporter";
import { TEST_USER, testEmail } from "./utils/routeDiscovery";

test.describe.configure({ mode: "serial" });

test.describe("Quero Armas — jornada humana", () => {
  test("Cenário A — Descobrir meu caminho", async ({ page }, testInfo) => {
    const signals = attachSignals(page);
    await page.goto("/");
    await waitForStable(page, 12_000);

    if (await isBlankPage(page)) {
      recordAudit({
        category: "journey",
        severity: "critical",
        step: "Home carrega",
        route: "/",
        message: "Home renderizou em branco.",
      });
      return;
    }

    if (signals.pageErrors.length) {
      recordAudit({
        category: "journey",
        severity: "critical",
        step: "Home — pageerror",
        route: "/",
        message: signals.pageErrors[0],
      });
    }

    await scrollLikeHuman(page);
    const cta = await findAndClickByIntent(page, [
      "descobrir meu caminho",
      "descubra",
      "descobrir",
      "começar",
      "iniciar",
    ]);

    if (!cta.clicked) {
      recordAudit({
        category: "journey",
        severity: "warn",
        route: "/",
        step: "CTA Descobrir meu caminho",
        message: 'Não encontrei CTA "Descobrir meu caminho" na home.',
        recommendation:
          "Garantir um CTA destacado na home apontando para /descobrir-meu-caminho.",
        file: "src/pages/HomePage.tsx",
      });
      await page.goto("/descobrir-meu-caminho");
    }

    await waitForStable(page, 12_000);
    const onQuiz = page.url().includes("descobrir-meu-caminho");
    if (!onQuiz) {
      recordAudit({
        category: "journey",
        severity: "warn",
        step: "Redirecionou para o quiz",
        route: page.url(),
        message: "CTA não levou ao quiz.",
        expected: "/descobrir-meu-caminho",
        found: page.url(),
      });
      await page.goto("/descobrir-meu-caminho");
      await waitForStable(page);
    }

    // Responde até 8 perguntas clicando na 1ª opção visível
    let answered = 0;
    for (let i = 0; i < 8; i++) {
      const advanced = await findAndClickByIntent(page, [
        "defesa pessoal",
        "posse",
        "sim",
        "continuar",
        "próximo",
        "avançar",
      ]);
      if (!advanced.clicked) break;
      answered++;
      await humanWait(page, "aguardando próxima pergunta", 400);
    }

    const finalCta = await findAndClickByIntent(page, [
      "contratar",
      "cadastrar",
      "ver recomendação",
      "começar agora",
      "continuar",
    ]);

    recordAudit({
      category: "journey",
      severity: answered === 0 ? "warn" : "info",
      step: "Quiz Descobrir Caminho",
      route: page.url(),
      message: `Respondeu ${answered} interação(ões) no quiz; CTA final ${
        finalCta.clicked ? "encontrado" : "ausente"
      }.`,
      expected: "Quiz avança e recomenda um serviço com CTA claro.",
      found: `passos=${answered}, cta=${finalCta.label || "n/a"}`,
      evidence: await safeShot(page, testInfo, "quiz-final"),
      file: "src/pages/QuizPage.tsx",
    });
  });

  test("Cenário B — Serviços → Carrinho → Checkout", async ({ page }, testInfo) => {
    attachSignals(page);
    await page.goto("/servicos");
    await waitForStable(page);

    const cards = page.locator("a, button").filter({ hasText: /contratar|saiba mais|ver detalhes|começar/i });
    const count = await cards.count().catch(() => 0);
    if (count === 0) {
      recordAudit({
        category: "journey",
        severity: "error",
        route: "/servicos",
        step: "Listagem de serviços",
        message: "Nenhum CTA de serviço encontrado em /servicos.",
        file: "src/pages/ServicesListPage.tsx",
      });
      return;
    }

    await cards.first().click().catch(() => {});
    await waitForStable(page);
    const slugUrl = page.url();
    recordAudit({
      category: "journey",
      severity: "info",
      route: slugUrl,
      step: "Página de detalhe do serviço",
      message: "Abriu detalhe do serviço a partir da listagem.",
      evidence: await safeShot(page, testInfo, "servico-detalhe"),
    });

    const addCart = await findAndClickByIntent(page, [
      "adicionar ao carrinho",
      "contratar agora",
      "contratar",
      "começar contratação",
    ]);

    if (!addCart.clicked) {
      recordAudit({
        category: "journey",
        severity: "warn",
        route: slugUrl,
        step: "Botão contratar/adicionar",
        message: "Página de serviço não oferece botão de contratação visível.",
        file: "src/pages/quero-armas/ServicoDetalhePage.tsx",
      });
    }

    // Vai para o carrinho explicitamente
    await page.goto("/carrinho");
    await waitForStable(page);
    const carrinhoTexto = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    recordAudit({
      category: "journey",
      severity: carrinhoTexto.includes("carrinho") ? "ok" : "warn",
      route: "/carrinho",
      step: "Carrinho",
      message: carrinhoTexto.includes("carrinho")
        ? "Carrinho renderizou."
        : "Carrinho não exibe título/conteúdo esperado.",
      evidence: await safeShot(page, testInfo, "carrinho"),
    });

    await findAndClickByIntent(page, ["finalizar", "ir para checkout", "checkout"]);
    if (!page.url().includes("checkout")) {
      await page.goto("/checkout/finalizar");
    }
    await waitForStable(page);
    const checkoutBlank = await isBlankPage(page);
    recordAudit({
      category: "journey",
      severity: checkoutBlank ? "critical" : "info",
      route: page.url(),
      step: "Checkout finalizar",
      message: checkoutBlank
        ? "Checkout renderizou em branco."
        : "Checkout carregou — verificar exigência de identificação.",
      evidence: await safeShot(page, testInfo, "checkout"),
      file: "src/pages/quero-armas/QACheckoutFinalizarPage.tsx",
    });
  });

  test("Cenário C — Cadastro público/refinado", async ({ page }, testInfo) => {
    const signals = attachSignals(page);
    await page.goto("/cadastro?origem=playwright_audit");
    await waitForStable(page, 15_000);

    if (await isBlankPage(page)) {
      recordAudit({
        category: "journey",
        severity: "critical",
        route: "/cadastro",
        step: "Cadastro abre",
        message: "/cadastro renderizou em branco.",
        file: "src/pages/quero-armas/cadastro-refinado/QACadastroRefinadoPage.tsx",
      });
      return;
    }

    const email = testEmail();
    // Preenche o que conseguir, por label/placeholder
    const fields: Array<[RegExp, string, string]> = [
      [/nome.*completo|seu nome/i, TEST_USER.nome, "nome"],
      [/cpf/i, TEST_USER.cpf, "cpf"],
      [/e-?mail/i, email, "email"],
      [/telefone|celular|whatsapp/i, TEST_USER.telefone, "telefone"],
      [/cep/i, TEST_USER.cep, "cep"],
      [/endere|rua|logradouro/i, TEST_USER.endereco, "endereço"],
      [/n[uú]mero/i, TEST_USER.numero, "número"],
      [/cidade/i, TEST_USER.cidade, "cidade"],
    ];

    let filled = 0;
    for (const [re, value, label] of fields) {
      const input = page.locator("input, textarea").filter({ has: page.locator("xpath=..") }).filter({
        hasText: "",
      });
      // Usa getByLabel/placeholder via roles
      const byLabel = page.getByLabel(re).first();
      const byPh = page.getByPlaceholder(re).first();
      let target = (await byLabel.isVisible().catch(() => false)) ? byLabel : null;
      if (!target && (await byPh.isVisible().catch(() => false))) target = byPh;
      if (target) {
        if (await humanFill(page, target, value, label)) filled++;
      }
    }

    // Tenta avançar
    const advanced = await findAndClickByIntent(page, [
      "continuar",
      "próximo",
      "avançar",
      "salvar e continuar",
    ]);

    const finalText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    const stuck = /obrigat[óo]rio|preencha|inválido|erro/.test(finalText);

    recordAudit({
      category: "journey",
      severity: filled === 0 ? "error" : stuck ? "warn" : "info",
      route: "/cadastro",
      step: "Etapa 01 — preencher cadastro",
      message: `Preencheu ${filled} campos; avanço ${
        advanced.clicked ? "tentado" : "não disponível"
      }; ${stuck ? "validações pendentes visíveis" : "sem alertas visíveis"}.`,
      expected: "Conseguir digitar dados básicos e avançar para Etapa 02.",
      found: `campos=${filled}, avançou=${advanced.clicked}, pageerrors=${signals.pageErrors.length}`,
      evidence: await safeShot(page, testInfo, "cadastro-etapa01"),
      file: "src/pages/quero-armas/cadastro-refinado/QACadastroRefinadoPage.tsx",
    });
  });

  test("Cenário D — Área do cliente (sem login real)", async ({ page }, testInfo) => {
    attachSignals(page);
    await page.goto("/area-do-cliente/login");
    await waitForStable(page);
    recordAudit({
      category: "journey",
      severity: (await isBlankPage(page)) ? "critical" : "ok",
      route: "/area-do-cliente/login",
      step: "Login do cliente carrega",
      message: "Tela de login do cliente.",
      evidence: await safeShot(page, testInfo, "cliente-login"),
      file: "src/pages/quero-armas/QAClienteLoginPage.tsx",
    });

    // Acessa a área protegida sem login — espera redirect/empty state
    await page.goto("/area-do-cliente");
    await waitForStable(page);
    const urlAfter = page.url();
    const blank = await isBlankPage(page);
    recordAudit({
      category: "journey",
      severity: blank ? "critical" : urlAfter.includes("login") ? "ok" : "info",
      route: "/area-do-cliente",
      step: "Acesso não autenticado",
      message: blank
        ? "Área do cliente em branco para anônimo."
        : `Comportamento: ${urlAfter.includes("login") ? "redirect para login" : "renderizou estado próprio"}.`,
      found: urlAfter,
      evidence: await safeShot(page, testInfo, "cliente-anonimo"),
    });
  });

  test("Cenário E — Rotas da Equipe Quero Armas (sem login)", async ({ page }, testInfo) => {
    attachSignals(page);
    const team = ["/dashboard", "/clientes", "/processos", "/auditoria", "/financeiro"];
    for (const r of team) {
      await page.goto(r);
      await waitForStable(page, 8000);
      const url = page.url();
      const blank = await isBlankPage(page);
      const adminTerm = await detectAdminTerm(page);
      const redirected = !url.endsWith(r);
      recordAudit({
        category: "journey",
        severity: blank ? "critical" : redirected ? "ok" : "warn",
        route: r,
        step: `Rota equipe ${r} sem login`,
        message: blank
          ? "Tela branca para anônimo."
          : redirected
            ? "Redirecionou corretamente."
            : "Rota acessível sem autenticação — revisar guard.",
        found: url,
        evidence: await safeShot(page, testInfo, `equipe-${r.replace(/\W/g, "_")}`),
      });
      if (adminTerm) {
        recordAudit({
          category: "terminology",
          severity: "warn",
          route: r,
          message: `Termo "${adminTerm}" exibido.`,
          found: adminTerm,
          recommendation: 'Substituir por "Equipe Quero Armas".',
        });
      }
    }
    expect(true).toBe(true);
  });
});

async function safeShot(
  page: import("@playwright/test").Page,
  info: import("@playwright/test").TestInfo,
  name: string,
) {
  try {
    const p = info.outputPath(`journey-${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    return p;
  } catch {
    return undefined;
  }
}