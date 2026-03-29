import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Copy, Check, RotateCw } from "lucide-react";
import type { TestCase, TestResult } from "./qaTypes";
import { computePriorityScore } from "./qaTypes";

interface Props {
  tests: TestCase[];
  results: Map<string, TestResult>;
  onRerun?: (test: TestCase) => void;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-600/20 text-red-400 border-red-600/30",
  high: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  medium: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  low: "bg-blue-600/20 text-blue-400 border-blue-600/30",
};

const statusIcons: Record<string, { label: string; color: string }> = {
  pass: { label: "✅ Aprovado", color: "text-green-400" },
  fail: { label: "❌ Falhou", color: "text-red-400" },
  warn: { label: "⚠️ Aviso", color: "text-yellow-400" },
  pending: { label: "⏳ Pendente", color: "text-muted-foreground" },
  running: { label: "🔄 Executando", color: "text-blue-400" },
  blocked: { label: "🚫 Bloqueado", color: "text-gray-400" },
  skipped: { label: "⏭️ Ignorado", color: "text-gray-400" },
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={(e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function QATestList({ tests, results, onRerun }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...tests].sort((a, b) => {
    const ra = results.get(a.id);
    const rb = results.get(b.id);
    if (!ra && !rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    return computePriorityScore(a, ra) - computePriorityScore(b, rb);
  });

  return (
    <div className="space-y-1">
      {sorted.map(test => {
        const result = results.get(test.id);
        const expanded = expandedId === test.id;
        const si = statusIcons[result?.status || "pending"];

        return (
          <Card key={test.id} className={`${result?.status === "fail" ? "border-destructive/30" : ""}`}>
            <CardContent className="p-2">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : test.id)}
              >
                {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <span className={`text-xs font-medium ${si.color}`}>{si.label.split(" ")[0]}</span>
                <span className="text-xs text-foreground flex-1 truncate">{test.name}</span>
                <Badge variant="outline" className={`text-[10px] ${severityColors[test.severity]}`}>
                  {test.severity}
                </Badge>
                {test.blocksPublish && (
                  <Badge variant="outline" className="text-[10px] bg-red-900/20 text-red-300 border-red-700/30">
                    Bloqueia
                  </Badge>
                )}
                {result && <span className="text-[10px] text-muted-foreground">{formatDuration(result.duration)}</span>}
              </div>

              {expanded && (
                <div className="mt-2 pl-5 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span>Cenário:</span><span className="text-foreground">{test.scenario}</span>
                    <span>Rota:</span><span className="text-foreground font-mono">{test.route || "—"}</span>
                    <span>Impacto comercial:</span><span className="text-foreground">{"⭐".repeat(test.commercialImpact)}</span>
                    <span>Impacto técnico:</span><span className="text-foreground">{"⭐".repeat(test.technicalImpact)}</span>
                  </div>

                  {result && (
                    <div className="space-y-1 bg-muted/30 rounded p-2">
                      <p className="text-foreground">{result.message}</p>
                      {result.technicalError && (
                        <p className="font-mono text-[10px] text-red-400 break-all">{result.technicalError}</p>
                      )}
                      {result.evidence && (
                        <pre className="text-[10px] text-muted-foreground overflow-auto max-h-32">{result.evidence}</pre>
                      )}
                      {result.dataUsed && (
                        <pre className="text-[10px] text-muted-foreground overflow-auto max-h-20">{result.dataUsed}</pre>
                      )}
                      <p className="text-[10px] text-muted-foreground">{new Date(result.executedAt).toLocaleString("pt-BR")}</p>
                    </div>
                  )}

                  <div className="flex gap-1">
                    {result && (
                      <CopyBtn text={`[${test.severity.toUpperCase()}] ${test.name}\nMódulo: ${test.module}\nRota: ${test.route || "—"}\nStatus: ${result.status}\nMensagem: ${result.message}\n${result.technicalError ? "Erro: " + result.technicalError : ""}\n${result.evidence ? "Evidência: " + result.evidence : ""}`} />
                    )}
                    {onRerun && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={(e) => { e.stopPropagation(); onRerun(test); }}>
                        <RotateCw className="h-3 w-3 mr-1" /> Reexecutar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
