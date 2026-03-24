import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ModuleStats } from "./qaTypes";
import { MODULE_LABELS } from "./qaTypes";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Shield } from "lucide-react";

interface Props {
  stats: ModuleStats;
  onClick: () => void;
  selected?: boolean;
}

export function QAModuleCard({ stats, onClick, selected }: Props) {
  const pct = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
  const statusColor = stats.readyToPublish === "ready"
    ? "border-green-500/40 bg-green-500/5"
    : stats.readyToPublish === "caution"
    ? "border-yellow-500/40 bg-yellow-500/5"
    : "border-red-500/40 bg-red-500/5";

  const publishLabel = stats.readyToPublish === "ready"
    ? "Pronto" : stats.readyToPublish === "caution" ? "Ressalvas" : "Bloqueado";

  const publishIcon = stats.readyToPublish === "ready"
    ? <CheckCircle2 className="h-3 w-3 text-green-500" />
    : stats.readyToPublish === "not_ready"
    ? <XCircle className="h-3 w-3 text-red-500" />
    : <AlertTriangle className="h-3 w-3 text-yellow-500" />;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${statusColor} ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-foreground">{MODULE_LABELS[stats.module]}</span>
          <div className="flex items-center gap-1 text-[11px]">
            {publishIcon}
            <span>{publishLabel}</span>
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3 text-green-500" />{stats.pass}</span>
          <span className="flex items-center gap-0.5"><XCircle className="h-3 w-3 text-red-500" />{stats.fail}</span>
          <span className="flex items-center gap-0.5"><AlertTriangle className="h-3 w-3 text-yellow-500" />{stats.warn}</span>
          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{stats.pending}</span>
          <span className="ml-auto font-bold">{pct}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
