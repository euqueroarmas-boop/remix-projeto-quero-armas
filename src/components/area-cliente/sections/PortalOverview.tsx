import { LayoutDashboard, Package, MessageSquare, DollarSign, FileText, FolderOpen, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientContracts, useClientPayments, useClientServiceRequests, useClientEvents } from "../hooks/useClientData";
import SectionHeader from "../shared/SectionHeader";
import StatusBadge from "../shared/StatusBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";

const eventIcons: Record<string, string> = {
  contrato: "📄", pagamento: "💳", cobranca: "🧾", servico: "📦",
  solicitacao: "📨", fiscal: "🏛️", cadastro: "👤",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  customer: CustomerData;
  onNavigate: (tab: string) => void;
}

export default function PortalOverview({ customer, onNavigate }: Props) {
  const { contracts, loading: cl } = useClientContracts(customer.id);
  const { payments, loading: pl } = useClientPayments(customer.id);
  const { requests, loading: rl } = useClientServiceRequests(customer.id);
  const { events, loading: el } = useClientEvents(customer.id);

  const activeContracts = contracts.filter((c) => c.signed);
  const pendingPayments = payments.filter((p) => p.payment_status === "pending" || p.payment_status === "PENDING");
  const openRequests = requests.filter((r) => !["concluido", "concluído", "cancelado"].includes(r.status));

  const cards = [
    { icon: Package, label: "Serviços Ativos", value: activeContracts.length, color: "text-emerald-400", tab: "servicos" },
    { icon: MessageSquare, label: "Solicitações Abertas", value: openRequests.length, color: "text-blue-400", tab: "solicitacoes" },
    { icon: DollarSign, label: "Cobranças Pendentes", value: pendingPayments.length, color: "text-yellow-400", tab: "financeiro" },
    { icon: FolderOpen, label: "Contratos", value: contracts.length, color: "text-primary", tab: "documentos" },
  ];

  const loading = cl || pl || rl;

  return (
    <div className="space-y-8">
      <SectionHeader icon={LayoutDashboard} title="Visão Geral" description={`Bem-vindo, ${customer.responsavel}`} />

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card
                  key={c.label}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => onNavigate(c.tab)}
                >
                  <CardContent className="p-5">
                    <Icon size={20} className={`${c.color} mb-2`} />
                    <p className="text-2xl font-heading font-bold text-foreground">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent payments */}
          {payments.length > 0 && (
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground mb-3">Últimos Pagamentos</h3>
              <div className="space-y-2">
                {payments.slice(0, 3).map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground font-medium">{p.billing_type || p.payment_method || "Pagamento"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                      </div>
                      <StatusBadge status={p.payment_status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Linha do Tempo
            </h3>
            {el ? (
              <LoadingSkeleton rows={3} />
            ) : events.length === 0 ? (
              <EmptyState icon={Clock} title="Nenhum evento" description="Os eventos do seu histórico aparecerão aqui." />
            ) : (
              <div className="space-y-2">
                {events.slice(0, 8).map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                    <span className="text-lg">{eventIcons[ev.event_type] || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">{ev.title}</p>
                      {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(ev.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
