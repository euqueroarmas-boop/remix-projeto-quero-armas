import type { TestResult } from "./qaTypes";

export interface QAExecutionRecord {
  id: string;
  executedAt: string;
  environment: string;
  type: "all" | "critical" | "module" | "individual";
  moduleFilter?: string;
  duration: number;
  results: TestResult[];
  summary: { pass: number; fail: number; warn: number; total: number };
}

export interface ComparisonItem {
  testId: string;
  category: "resolved" | "persistent" | "new_error" | "regression" | "unchanged";
  previous?: TestResult;
  current?: TestResult;
}

const EXECUTIONS_KEY = "wmti_qa_executions";
const MAX_EXECUTIONS = 20;

export function loadExecutions(): QAExecutionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(EXECUTIONS_KEY) || "[]");
  } catch { return []; }
}

export function saveExecution(exec: QAExecutionRecord): void {
  const all = loadExecutions();
  all.unshift(exec);
  if (all.length > MAX_EXECUTIONS) all.length = MAX_EXECUTIONS;
  localStorage.setItem(EXECUTIONS_KEY, JSON.stringify(all));
}

export function compareExecutions(
  previous: TestResult[],
  current: TestResult[]
): ComparisonItem[] {
  const prevMap = new Map(previous.map(r => [r.testId, r]));
  const curMap = new Map(current.map(r => [r.testId, r]));
  const allIds = new Set([...prevMap.keys(), ...curMap.keys()]);
  const items: ComparisonItem[] = [];

  allIds.forEach(id => {
    const prev = prevMap.get(id);
    const cur = curMap.get(id);
    const prevFail = prev && (prev.status === "fail" || prev.status === "warn");
    const curFail = cur && (cur.status === "fail" || cur.status === "warn");
    const prevPass = prev && prev.status === "pass";
    const curPass = cur && cur.status === "pass";

    let category: ComparisonItem["category"];
    if (prevFail && curPass) category = "resolved";
    else if (prevFail && curFail) category = "persistent";
    else if (!prev && curFail) category = "new_error";
    else if (prevPass && curFail) category = "regression";
    else category = "unchanged";

    items.push({ testId: id, category, previous: prev, current: cur });
  });

  return items;
}
