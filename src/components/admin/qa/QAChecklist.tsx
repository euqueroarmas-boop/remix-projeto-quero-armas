import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChecklistItem, QAModule } from "./qaTypes";
import { QA_MODULES, MODULE_LABELS } from "./qaTypes";
import { DEFAULT_CHECKLIST_ITEMS } from "./qaFixtures";
import { CheckCircle2, XCircle, Eye, Wrench, Ban } from "lucide-react";

const STORAGE_KEY = "wmti_qa_checklist";

type CStatus = ChecklistItem["status"];

const statusConfig: Record<CStatus, { icon: React.ReactNode; label: string; color: string }> = {
  approved: { icon: <CheckCircle2 className="h-3 w-3" />, label: "Aprovado", color: "text-green-500" },
  failed: { icon: <XCircle className="h-3 w-3" />, label: "Reprovado", color: "text-red-500" },
  review: { icon: <Eye className="h-3 w-3" />, label: "Revisar", color: "text-yellow-500" },
  fixed: { icon: <Wrench className="h-3 w-3" />, label: "Corrigido", color: "text-blue-500" },
  blocked: { icon: <Ban className="h-3 w-3" />, label: "Bloqueado", color: "text-gray-500" },
  pending: { icon: null, label: "Pendente", color: "text-muted-foreground" },
};

export function QAChecklist({ moduleFilter }: { moduleFilter?: QAModule | "all" }) {
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return DEFAULT_CHECKLIST_ITEMS.map((item, i) => ({
      id: `chk-${i}`,
      ...item,
      status: "pending" as CStatus,
    }));
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const updateStatus = (id: string, status: CStatus) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
    ));
  };

  const filtered = moduleFilter && moduleFilter !== "all"
    ? items.filter(i => i.module === moduleFilter)
    : items;

  const counts = {
    approved: filtered.filter(i => i.status === "approved").length,
    failed: filtered.filter(i => i.status === "failed").length,
    pending: filtered.filter(i => i.status === "pending").length,
    total: filtered.length,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>✅ {counts.approved}</span>
        <span>❌ {counts.failed}</span>
        <span>⏳ {counts.pending}</span>
        <span className="ml-auto">{counts.total} itens</span>
      </div>

      {filtered.map(item => {
        const cfg = statusConfig[item.status];
        return (
          <Card key={item.id} className={item.status === "failed" ? "border-destructive/30" : ""}>
            <CardContent className="p-2 flex items-center gap-2">
              <span className={`text-xs font-medium ${cfg.color} w-20 flex items-center gap-1`}>
                {cfg.icon}{cfg.label}
              </span>
              <span className="text-xs text-foreground flex-1">{item.description}</span>
              <span className="text-[10px] text-muted-foreground">{MODULE_LABELS[item.module]}</span>
              <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v as CStatus)}>
                <SelectTrigger className="w-24 h-6 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusConfig) as CStatus[]).map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{statusConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
