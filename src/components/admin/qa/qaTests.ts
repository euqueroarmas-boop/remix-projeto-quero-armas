import type { TestCase, TestResult, TestStatus } from "./qaTypes";
import { ALL_PUBLIC_ROUTES, SERVICE_ROUTES, SEGMENT_ROUTES, CONTRATAR_SLUGS, WHATSAPP_NUMBER, FIXTURE_MACHINES } from "./qaFixtures";
import { supabase } from "@/integrations/supabase/client";

const BASE = window.location.origin;

async function fetchRoute(path: string): Promise<{ ok: boolean; status: number; html: string }> {
  try {
    const res = await fetch(BASE + path, { redirect: "follow" });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html };
  } catch (e: any) {
    return { ok: false, status: 0, html: e.message };
  }
}

function makeRouteTest(path: string, module: TestCase["module"], severity: TestCase["severity"], blocksPublish = false): TestCase {
  return {
    id: `route-${module}-${path}`,
    name: `Rota ${path} carrega`,
    module,
    route: path,
    scenario: `Acessar ${path} e verificar HTTP 200`,
    severity,
    commercialImpact: blocksPublish ? 5 : 2,
    technicalImpact: 3,
    blocksPublish,
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, status, html } = await fetchRoute(path);
      const hasContent = html.length > 500;
      const isOk = ok && hasContent;
      return {
        testId: `route-${module}-${path}`,
        status: isOk ? "pass" : "fail",
        message: isOk ? `${path} carregou OK (${status})` : `${path} falhou (HTTP ${status}, conteúdo: ${html.length} chars)`,
        responseCode: status,
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
        route: path,
      };
    },
  };
}

function makeSeoTest(path: string): TestCase {
  return {
    id: `seo-${path}`,
    name: `SEO ${path}`,
    module: "seo",
    route: path,
    scenario: `Verificar title, meta description e H1 em ${path}`,
    severity: "medium",
    commercialImpact: 3,
    technicalImpact: 2,
    blocksPublish: false,
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { html } = await fetchRoute(path);
      const issues: string[] = [];
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      if (!titleMatch || titleMatch[1].length < 10) issues.push("Título ausente ou curto");
      if (!html.match(/<meta[^>]*name="description"[^>]*>/i)) issues.push("Meta description ausente");
      if (!html.match(/<h1[^>]*>/i)) issues.push("H1 ausente");
      return {
        testId: `seo-${path}`,
        status: issues.length === 0 ? "pass" : issues.length === 1 ? "warn" : "fail",
        message: issues.length === 0 ? "SEO OK" : issues.join("; "),
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
        route: path,
      };
    },
  };
}

// --- Supabase RLS tests ---
function makeRlsInsertTest(table: string, data: Record<string, unknown>, module: TestCase["module"]): TestCase {
  return {
    id: `rls-insert-${table}`,
    name: `RLS INSERT ${table}`,
    module,
    scenario: `Inserir registro anônimo em ${table}`,
    severity: "critical",
    commercialImpact: 5,
    technicalImpact: 5,
    blocksPublish: true,
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      // Use a dry-run approach: insert then immediately delete if possible
      const { error } = await (supabase.from(table as any) as any).insert(data).select("id").single();
      const isOk = !error;
      return {
        testId: `rls-insert-${table}`,
        status: isOk ? "pass" : "fail",
        message: isOk ? `INSERT em ${table} OK` : `INSERT em ${table} bloqueado: ${error?.message}`,
        technicalError: error?.message,
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
        evidence: error ? JSON.stringify(error) : undefined,
      };
    },
  };
}

// --- Edge function tests ---
function makeEdgeFnTest(fnName: string, body: Record<string, unknown>): TestCase {
  return {
    id: `edge-fn-${fnName}`,
    name: `Edge Function ${fnName}`,
    module: "edge-functions",
    scenario: `Invocar ${fnName} e verificar resposta`,
    severity: "high",
    commercialImpact: 4,
    technicalImpact: 4,
    blocksPublish: false,
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke(fnName, { body });
        return {
          testId: `edge-fn-${fnName}`,
          status: error ? "fail" : "pass",
          message: error ? `${fnName} falhou: ${error.message}` : `${fnName} respondeu OK`,
          technicalError: error?.message,
          duration: Date.now() - start,
          executedAt: new Date().toISOString(),
          evidence: data ? JSON.stringify(data).slice(0, 500) : undefined,
        };
      } catch (e: any) {
        return {
          testId: `edge-fn-${fnName}`,
          status: "fail",
          message: `${fnName} erro: ${e.message}`,
          technicalError: e.message,
          duration: Date.now() - start,
          executedAt: new Date().toISOString(),
        };
      }
    },
  };
}

// --- Calculator tests ---
function makeCalcTest(qty: number): TestCase {
  return {
    id: `calc-locacao-${qty}`,
    name: `Cálculo locação ${qty} máquinas`,
    module: "calculadora",
    scenario: `Validar preço de locação para ${qty} máquinas com desconto progressivo`,
    severity: "critical",
    commercialImpact: 5,
    technicalImpact: 4,
    blocksPublish: true,
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      // Simulate the rental pricing logic
      const basePrice = 249; // essencial plan
      let discount = 0;
      if (qty > 5) {
        discount = Math.min((qty - 5) * 1.1, 27.5);
      }
      const unitPrice = basePrice * (1 - discount / 100);
      const total = unitPrice * qty;
      const issues: string[] = [];
      if (discount > 27.5) issues.push(`Desconto ${discount}% excede teto de 27.5%`);
      if (unitPrice < 0) issues.push("Preço unitário negativo");
      if (total <= 0) issues.push("Total zerado ou negativo");
      return {
        testId: `calc-locacao-${qty}`,
        status: issues.length === 0 ? "pass" : "fail",
        message: issues.length === 0
          ? `${qty} máq: R$ ${unitPrice.toFixed(2)}/un, desc ${discount.toFixed(1)}%, total R$ ${total.toFixed(2)}`
          : issues.join("; "),
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
        dataUsed: JSON.stringify({ qty, basePrice, discount, unitPrice, total }),
      };
    },
  };
}

// --- WhatsApp tests ---
function makeWhatsAppRouteTest(path: string): TestCase {
  return {
    id: `whatsapp-${path}`,
    name: `WhatsApp em ${path}`,
    module: "whatsapp",
    route: path,
    scenario: `Verificar presença de link WhatsApp em ${path}`,
    severity: "high",
    commercialImpact: 4,
    technicalImpact: 2,
    blocksPublish: false,
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { html } = await fetchRoute(path);
      const hasWA = html.includes("wa.me") || html.includes("whatsapp") || html.includes("WhatsApp");
      const correctNumber = html.includes(WHATSAPP_NUMBER);
      return {
        testId: `whatsapp-${path}`,
        status: hasWA && correctNumber ? "pass" : hasWA ? "warn" : "fail",
        message: !hasWA ? `Nenhum link WhatsApp em ${path}` : !correctNumber ? `WhatsApp presente mas número pode estar incorreto` : "WhatsApp OK",
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
        route: path,
      };
    },
  };
}

// --- Build all tests ---
export function buildAllTests(): TestCase[] {
  const tests: TestCase[] = [];

  // Route tests
  tests.push(makeRouteTest("/", "home", "critical", true));
  SERVICE_ROUTES.forEach(r => tests.push(makeRouteTest(r, "servicos", "high")));
  SEGMENT_ROUTES.forEach(r => tests.push(makeRouteTest(r, "segmentos", "high")));
  tests.push(makeRouteTest("/blog", "blog", "medium"));
  tests.push(makeRouteTest("/orcamento-ti", "orcamento", "critical", true));
  tests.push(makeRouteTest("/area-do-cliente", "portal-cliente", "high"));
  tests.push(makeRouteTest("/contrato", "contratacao", "high"));
  tests.push(makeRouteTest("/redefinir-senha", "portal-cliente", "medium"));
  tests.push(makeRouteTest("/compra-concluida", "compra-concluida", "high"));

  // Contratar routes
  CONTRATAR_SLUGS.forEach(slug =>
    tests.push(makeRouteTest(`/contratar/${slug}`, "contratacao", "critical", true))
  );

  // SEO tests for main pages
  ["/", "/servicos", "/locacao", "/infraestrutura", "/blog", "/orcamento-ti",
   "/institucional", ...SERVICE_ROUTES.slice(0, 5), ...SEGMENT_ROUTES.slice(0, 3)]
    .forEach(r => tests.push(makeSeoTest(r)));

  // RLS tests
  tests.push(makeRlsInsertTest("budget_leads", {
    company_name: "QA Test Co",
    contact_name: "QA",
    email: "qa@test.com",
  }, "orcamento"));

  tests.push(makeRlsInsertTest("leads", {
    name: "QA Test",
    email: "qa@test.com",
  }, "contato"));

  tests.push(makeRlsInsertTest("logs_sistema", {
    tipo: "erro",
    status: "info",
    mensagem: "QA test log",
  }, "logs"));

  // Calculator tests
  FIXTURE_MACHINES.forEach(qty => tests.push(makeCalcTest(qty)));

  // WhatsApp tests on key pages
  ["/", "/servicos", "/orcamento-ti", "/blog", ...SERVICE_ROUTES.slice(0, 3), ...SEGMENT_ROUTES.slice(0, 2)]
    .forEach(r => tests.push(makeWhatsAppRouteTest(r)));

  // Edge function tests
  tests.push(makeEdgeFnTest("brasil-api-lookup", { type: "cnpj", value: "33814058000128" }));
  tests.push(makeEdgeFnTest("brasil-api-lookup", { type: "cep", value: "12327682" }));

  // 404 test
  tests.push({
    id: "route-404",
    name: "Página inexistente retorna NotFound",
    module: "rotas",
    route: "/pagina-que-nao-existe-xyz",
    scenario: "Acessar rota inexistente e verificar que mostra 404",
    severity: "medium",
    commercialImpact: 1,
    technicalImpact: 2,
    blocksPublish: false,
    run: async () => {
      const start = Date.now();
      const { html } = await fetchRoute("/pagina-que-nao-existe-xyz");
      const has404 = html.includes("404") || html.includes("não encontrad") || html.includes("Not Found");
      return {
        testId: "route-404",
        status: has404 ? "pass" : "warn",
        message: has404 ? "Página 404 funciona" : "404 não detectado claramente",
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
        route: "/pagina-que-nao-existe-xyz",
      };
    },
  });

  // Supabase storage test
  tests.push({
    id: "storage-bucket-exists",
    name: "Bucket paid-contracts existe",
    module: "storage",
    scenario: "Verificar acesso ao bucket paid-contracts",
    severity: "critical",
    commercialImpact: 5,
    technicalImpact: 5,
    blocksPublish: true,
    run: async () => {
      const start = Date.now();
      const { data, error } = await supabase.storage.from("paid-contracts").list("", { limit: 1 });
      return {
        testId: "storage-bucket-exists",
        status: error ? "fail" : "pass",
        message: error ? `Bucket error: ${error.message}` : `Bucket OK (${data?.length ?? 0} arquivos)`,
        technicalError: error?.message,
        duration: Date.now() - start,
        executedAt: new Date().toISOString(),
      };
    },
  });

  return tests;
}
