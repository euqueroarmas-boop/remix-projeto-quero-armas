import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  // payments
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CONFIRMED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  RECEIVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pago: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  overdue: "bg-red-500/10 text-red-400 border-red-500/20",
  OVERDUE: "bg-red-500/10 text-red-400 border-red-500/20",
  vencido: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  cancelado: "bg-muted text-muted-foreground border-border",
  // contracts
  draft: "bg-muted text-muted-foreground border-border",
  signed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  // requests
  recebido: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "em análise": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "em_analise": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "aguardando cliente": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "aguardando_cliente": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "em execução": "bg-primary/10 text-primary border-primary/20",
  "em_execucao": "bg-primary/10 text-primary border-primary/20",
  concluído: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  concluido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  // fiscal
  emitido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pendente: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  CONFIRMED: "Confirmado",
  RECEIVED: "Recebido",
  overdue: "Vencido",
  OVERDUE: "Vencido",
  cancelled: "Cancelado",
  draft: "Rascunho",
  signed: "Assinado",
  active: "Ativo",
  recebido: "Recebido",
  em_analise: "Em Análise",
  "em análise": "Em Análise",
  aguardando_cliente: "Aguardando Cliente",
  "aguardando cliente": "Aguardando Cliente",
  em_execucao: "Em Execução",
  "em execução": "Em Execução",
  concluido: "Concluído",
  concluído: "Concluído",
  cancelado: "Cancelado",
  emitido: "Emitido",
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
};

export default function StatusBadge({ status }: { status: string | null }) {
  const s = status || "pending";
  const color = statusColors[s] || "bg-muted text-muted-foreground border-border";
  const label = statusLabels[s] || s;
  return (
    <Badge variant="outline" className={`${color} text-[11px] font-mono uppercase tracking-wider border`}>
      {label}
    </Badge>
  );
}
