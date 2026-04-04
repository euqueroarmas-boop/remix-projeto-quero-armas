import { AlertTriangle, CreditCard, RefreshCw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  status: string;
  message: string;
  invoiceUrl?: string | null;
  onRequestReview?: () => void;
}

const statusConfig: Record<string, { icon: typeof AlertTriangle; color: string; title: string }> = {
  contract_generated: { icon: CreditCard, color: "text-blue-400", title: "Contrato gerado — aguardando pagamento" },
  payment_pending: { icon: RefreshCw, color: "text-yellow-400", title: "Pagamento pendente" },
  payment_under_review: { icon: HelpCircle, color: "text-orange-400", title: "Pagamento em análise" },
  overdue: { icon: AlertTriangle, color: "text-red-400", title: "Pagamento vencido" },
  suspended: { icon: AlertTriangle, color: "text-red-500", title: "Serviço suspenso" },
};

export default function PaymentPendingBanner({ status, message, invoiceUrl, onRequestReview }: Props) {
  const config = statusConfig[status] || statusConfig.payment_pending;
  const Icon = config.icon;

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Icon size={20} className={`${config.color} mt-0.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-heading font-bold text-foreground">{config.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{message}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="text-xs">
                    <CreditCard size={12} className="mr-1" /> Ver cobrança / Pagar
                  </Button>
                </a>
              )}
              {onRequestReview && (
                <Button size="sm" variant="ghost" className="text-xs" onClick={onRequestReview}>
                  <HelpCircle size={12} className="mr-1" /> Já paguei / Solicitar revisão
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
