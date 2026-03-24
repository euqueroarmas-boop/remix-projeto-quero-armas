import type { TestCase, TestResult, ChecklistItem, QAModule } from "./qaTypes";
import { MODULE_LABELS } from "./qaTypes";

export function generateReport(tests: TestCase[], results: Map<string, TestResult>, checklist: ChecklistItem[]): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString("pt-BR");
  const env = window.location.hostname.includes("lovable") ? "Preview/Homologação" : "Produção";

  const pass = Array.from(results.values()).filter(r => r.status === "pass").length;
  const fail = Array.from(results.values()).filter(r => r.status === "fail").length;
  const warn = Array.from(results.values()).filter(r => r.status === "warn").length;
  const pending = tests.length - results.size;

  lines.push("═══════════════════════════════════════");
  lines.push("  RELATÓRIO DE HOMOLOGAÇÃO — WMTi");
  lines.push("═══════════════════════════════════════");
  lines.push(`Data: ${now}`);
  lines.push(`Ambiente: ${env}`);
  lines.push(`Total de testes: ${tests.length}`);
  lines.push(`✅ Aprovados: ${pass}`);
  lines.push(`❌ Falhos: ${fail}`);
  lines.push(`⚠️ Avisos: ${warn}`);
  lines.push(`⏳ Pendentes: ${pending}`);
  lines.push("");

  // Group by module
  const modules = new Set(tests.map(t => t.module));
  for (const mod of modules) {
    const modTests = tests.filter(t => t.module === mod);
    const modResults = modTests.map(t => results.get(t.id)).filter(Boolean);
    const modPass = modResults.filter(r => r!.status === "pass").length;
    const modFail = modResults.filter(r => r!.status === "fail").length;

    lines.push(`── ${MODULE_LABELS[mod]} (${modPass}/${modTests.length} OK) ──`);

    for (const test of modTests) {
      const r = results.get(test.id);
      const status = r ? r.status.toUpperCase() : "PENDENTE";
      const icon = r?.status === "pass" ? "✅" : r?.status === "fail" ? "❌" : r?.status === "warn" ? "⚠️" : "⏳";
      lines.push(`  ${icon} [${test.severity.toUpperCase()}] ${test.name}`);
      if (r && r.status !== "pass") {
        lines.push(`     Mensagem: ${r.message}`);
        if (r.technicalError) lines.push(`     Erro: ${r.technicalError}`);
        if (r.route) lines.push(`     Rota: ${r.route}`);
      }
    }
    lines.push("");
  }

  // Checklist
  if (checklist.length > 0) {
    lines.push("── CHECKLIST MANUAL ──");
    for (const item of checklist) {
      const icon = item.status === "approved" ? "✅" : item.status === "failed" ? "❌" : "⏳";
      lines.push(`  ${icon} [${MODULE_LABELS[item.module]}] ${item.description} → ${item.status}`);
    }
  }

  lines.push("");
  lines.push("═══════════════════════════════════════");
  lines.push("  FIM DO RELATÓRIO");
  lines.push("═══════════════════════════════════════");

  return lines.join("\n");
}

export function generateFailuresOnly(tests: TestCase[], results: Map<string, TestResult>): string {
  const failures = tests.filter(t => {
    const r = results.get(t.id);
    return r && (r.status === "fail" || r.status === "warn");
  });

  if (failures.length === 0) return "Nenhuma falha encontrada! 🎉";

  const lines = ["FALHAS ENCONTRADAS — WMTi", ""];
  const sorted = failures.sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
  });

  for (const test of sorted) {
    const r = results.get(test.id)!;
    lines.push(`[${test.severity.toUpperCase()}] ${test.name}`);
    lines.push(`  Módulo: ${MODULE_LABELS[test.module]}`);
    lines.push(`  Rota: ${test.route || "—"}`);
    lines.push(`  Status: ${r.status}`);
    lines.push(`  Mensagem: ${r.message}`);
    if (r.technicalError) lines.push(`  Erro técnico: ${r.technicalError}`);
    if (r.evidence) lines.push(`  Evidência: ${r.evidence}`);
    lines.push(`  Bloqueia publicação: ${test.blocksPublish ? "SIM" : "Não"}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function generatePriorityList(tests: TestCase[], results: Map<string, TestResult>): string {
  const failures = tests
    .filter(t => { const r = results.get(t.id); return r && r.status === "fail"; })
    .sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sa = (sevOrder[a.severity] || 3) * 10 - a.commercialImpact * 2;
      const sb = (sevOrder[b.severity] || 3) * 10 - b.commercialImpact * 2;
      return sa - sb;
    });

  if (failures.length === 0) return "Nenhuma correção necessária! ✅";

  const lines = ["ORDEM RECOMENDADA DE CORREÇÃO — WMTi", ""];
  failures.forEach((test, i) => {
    const r = results.get(test.id)!;
    lines.push(`${i + 1}. [${test.severity.toUpperCase()}] ${test.name}`);
    lines.push(`   ${r.message}`);
    lines.push(`   Impacto: comercial ${test.commercialImpact}/5, técnico ${test.technicalImpact}/5`);
    lines.push("");
  });

  return lines.join("\n");
}
