import type { TestCase, TestResult, ModuleStats, QAModule } from "./qaTypes";
import { QA_MODULES } from "./qaTypes";

export type ProgressCallback = (completed: number, total: number, current: string) => void;

export async function runTests(
  tests: TestCase[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (let i = 0; i < tests.length; i++) {
    if (signal?.aborted) break;
    const test = tests[i];
    onProgress?.(i, tests.length, test.name);
    try {
      const result = await test.run();
      results.push(result);
    } catch (e: any) {
      results.push({
        testId: test.id,
        status: "fail",
        message: `Exceção: ${e.message}`,
        technicalError: e.stack || e.message,
        duration: 0,
        executedAt: new Date().toISOString(),
      });
    }
  }
  onProgress?.(tests.length, tests.length, "Concluído");
  return results;
}

export function computeModuleStats(tests: TestCase[], results: TestResult[]): ModuleStats[] {
  const resultMap = new Map(results.map(r => [r.testId, r]));
  return QA_MODULES.map(mod => {
    const modTests = tests.filter(t => t.module === mod);
    const modResults = modTests.map(t => resultMap.get(t.id));
    const stats: ModuleStats = {
      module: mod,
      total: modTests.length,
      pass: modResults.filter(r => r?.status === "pass").length,
      fail: modResults.filter(r => r?.status === "fail").length,
      warn: modResults.filter(r => r?.status === "warn").length,
      pending: modResults.filter(r => !r || r.status === "pending").length,
      blocked: modResults.filter(r => r?.status === "blocked").length,
      skipped: modResults.filter(r => r?.status === "skipped").length,
      running: modResults.filter(r => r?.status === "running").length,
      riskLevel: "low",
      readyToPublish: "ready",
    };
    // If no results yet, all pending
    if (results.length === 0) stats.pending = modTests.length;

    const critFails = modTests.filter(t => t.severity === "critical" && resultMap.get(t.id)?.status === "fail").length;
    const highFails = modTests.filter(t => t.severity === "high" && resultMap.get(t.id)?.status === "fail").length;
    if (critFails > 0) { stats.riskLevel = "critical"; stats.readyToPublish = "not_ready"; }
    else if (highFails > 0) { stats.riskLevel = "high"; stats.readyToPublish = "caution"; }
    else if (stats.fail > 0) { stats.riskLevel = "medium"; stats.readyToPublish = "caution"; }
    return stats;
  }).filter(s => s.total > 0);
}

export function getEnvironment(): string {
  const host = window.location.hostname;
  if (host.includes("lovableproject.com") || host.includes("lovable.app")) return "preview";
  if (host.includes("localhost")) return "local";
  return "produção";
}
