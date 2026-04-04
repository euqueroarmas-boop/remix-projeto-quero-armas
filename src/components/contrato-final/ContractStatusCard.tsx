import { CheckCircle2, Clock, FileText, Loader2, AlertCircle, Eye, Download, Mail, RefreshCw, ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { OrderContext, OrderStatus } from "@/pages/ContratoFinalPage";
import { copyErrorToClipboard } from "@/lib/errorLogger";
import { useState } from "react";

interface Props {
  ctx: OrderContext;
  quoteId: string;
  onRetry: () => void;
  onGenerate: () => void;
  onDownload: () => void;
  onView: () => void;
  onEmail: () => void;
  onGoToPayment: () => void;
  onGoToAccess: () => void;
}

const STATUS_CONFIG: Record<OrderStatus, {
  icon: React.ReactNode;
  title: string;
  description: string;
  progress: number;
  colorClass: string;
  iconBgClass: string;
}> = {
  loading: {
    icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
    title: "Carregando seu pedido…",
    description: "Estamos verificando o status do seu pedido.",
    progress: 10,
    colorClass: "text-primary",
    iconBgClass: "bg-primary/10 border-primary/20",
  },
  awaiting_payment: {
    icon: <Clock className="h-8 w-8 text-yellow-400" />,
    title: "Aguardando confirmação de pagamento",
    description: "Assim que o pagamento for confirmado, seu contrato será gerado automaticamente.",
    progress: 25,
    colorClass: "text-yellow-400",
    iconBgClass: "bg-yellow-400/10 border-yellow-400/20",
  },
  processing_payment: {
    icon: <Loader2 className="h-8 w-8 animate-spin text-blue-400" />,
    title: "Processando pagamento",
    description: "Pagamento recebido! Estamos preparando tudo para você.",
    progress: 50,
    colorClass: "text-blue-400",
    iconBgClass: "bg-blue-400/10 border-blue-400/20",
  },
  generating_contract: {
    icon: <FileText className="h-8 w-8 animate-pulse text-blue-400" />,
    title: "Gerando seu contrato…",
    description: "Estamos preparando seu contrato em PDF. Isso leva apenas alguns segundos.",
    progress: 75,
    colorClass: "text-blue-400",
    iconBgClass: "bg-blue-400/10 border-blue-400/20",
  },
  ready: {
    icon: <CheckCircle2 className="h-8 w-8 text-emerald-400" />,
    title: "Contrato pronto!",
    description: "Seu contrato foi gerado com sucesso. Você pode visualizar, baixar ou receber por e-mail.",
    progress: 100,
    colorClass: "text-emerald-400",
    iconBgClass: "bg-emerald-400/10 border-emerald-400/20",
  },
  technical_error: {
    icon: <AlertCircle className="h-8 w-8 text-yellow-400" />,
    title: "Instabilidade momentânea",
    description: "Estamos com uma instabilidade temporária. Tente novamente em instantes — sua compra está segura.",
    progress: 0,
    colorClass: "text-yellow-400",
    iconBgClass: "bg-yellow-400/10 border-yellow-400/20",
  },
};

const STEPS = [
  { key: "order", label: "Pedido" },
  { key: "payment", label: "Pagamento" },
  { key: "contract", label: "Contrato" },
  { key: "access", label: "Acesso" },
] as const;

function getActiveStep(status: OrderStatus): number {
  switch (status) {
    case "loading": return 0;
    case "awaiting_payment": return 1;
    case "processing_payment": return 1;
    case "generating_contract": return 2;
    case "ready": return 3;
    case "technical_error": return 1;
    default: return 0;
  }
}

function getPaymentLabel(method?: string) {
  if (!method) return "";
  const map: Record<string, string> = {
    BOLETO: "Boleto bancário",
    CREDIT_CARD: "Cartão de crédito",
    PIX: "Pix",
    UNDEFINED: "—",
  };
  return map[method] || method;
}

function getPaymentStatusLabel(status?: string) {
  if (!status) return "Pendente";
  const map: Record<string, string> = {
    PENDING: "Pendente",
    RECEIVED: "Confirmado",
    CONFIRMED: "Confirmado",
    RECEIVED_IN_CASH: "Confirmado",
    OVERDUE: "Vencido",
    REFUNDED: "Estornado",
  };
  return map[status] || status;
}

export function ContractStatusCard({ ctx, quoteId, onRetry, onGenerate, onDownload, onView, onEmail, onGoToPayment, onGoToAccess }: Props) {
  const config = STATUS_CONFIG[ctx.status];
  const activeStep = getActiveStep(ctx.status);
  const isLoading = ctx.status === "loading" || ctx.status === "generating_contract";
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          return (
            <div key={step.key} className="flex flex-col items-center flex-1">
              <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                done ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                current ? `${config.iconBgClass} ${config.colorClass} border-current` :
                "bg-muted/20 border-border text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[10px] mt-1.5 font-medium ${
                done ? "text-emerald-400" : current ? "text-foreground" : "text-muted-foreground"
              }`}>{step.label}</span>
              {i < STEPS.length - 1 && (
                <div className="hidden" /> // connector handled by flex gap
              )}
            </div>
          );
        })}
      </div>

      {/* Connector lines between steps */}
      <div className="flex items-center px-6 -mt-10 mb-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex-1 h-0.5 mx-1 rounded transition-all duration-500 ${
            i < activeStep ? "bg-emerald-500/60" : "bg-border"
          }`} />
        ))}
      </div>

      {/* Main Status Card */}
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 shadow-xl space-y-6">
        {/* Icon + Title */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border ${config.iconBgClass}`}>
            {config.icon}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">{config.title}</h1>
            <p className="text-sm text-muted-foreground max-w-md">{config.description}</p>
          </div>
        </div>

        {/* Progress bar (non-error states) */}
        {ctx.status !== "technical_error" && (
          <div className="space-y-1.5">
            <Progress value={config.progress} className="h-2" />
            <p className="text-[11px] text-muted-foreground text-right">{config.progress}%</p>
          </div>
        )}

        {/* Payment info (when relevant) */}
        {ctx.paymentMethod && ctx.status !== "loading" && (
          <div className="rounded-xl border border-border bg-muted/10 p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Método</p>
              <p className="text-foreground font-medium flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                {getPaymentLabel(ctx.paymentMethod)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <p className={`font-medium ${
                ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(ctx.paymentStatus || "")
                  ? "text-emerald-400" : "text-yellow-400"
              }`}>
                {getPaymentStatusLabel(ctx.paymentStatus)}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isLoading && (
          <div className="flex flex-col gap-3">
            {ctx.status === "awaiting_payment" && (
              <Button onClick={onGoToPayment} className="w-full">
                <ArrowRight className="mr-2 h-4 w-4" />
                Ver detalhes do pagamento
              </Button>
            )}

            {ctx.status === "processing_payment" && (
              <Button onClick={onGenerate} className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Gerar contrato agora
              </Button>
            )}

            {ctx.status === "ready" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={onView} className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    Visualizar
                  </Button>
                  <Button variant="outline" onClick={onDownload} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PDF
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={onEmail} disabled={ctx.emailing} className="w-full">
                    {ctx.emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Enviar por e-mail
                  </Button>
                  <Button variant="outline" onClick={onGoToAccess} className="w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Acessar portal
                  </Button>
                </div>
              </>
            )}

            {ctx.status === "technical_error" && (
              <Button onClick={onRetry} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {/* Debug/admin - hidden by default */}
        {ctx.status === "technical_error" && ctx.lastError && (
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setDebugOpen(!debugOpen)}
              className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {debugOpen ? "Ocultar detalhes técnicos ▲" : "Detalhes técnicos ▼"}
            </button>
            {debugOpen && (
              <div className="mt-2 space-y-2 text-xs">
                <p className="text-muted-foreground font-mono break-all">{ctx.lastError.message}</p>
                {ctx.lastError.technicalMessage && ctx.lastError.technicalMessage !== ctx.lastError.message && (
                  <p className="text-muted-foreground/60 font-mono break-all">{ctx.lastError.technicalMessage}</p>
                )}
                <button
                  onClick={() => copyErrorToClipboard(ctx.lastError!)}
                  className="text-[10px] text-primary/60 hover:text-primary underline transition-colors"
                >
                  Copiar erro para suporte
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quote reference */}
      {quoteId && (
        <p className="text-center text-[11px] text-muted-foreground/40 font-mono">
          Pedido #{quoteId.slice(0, 8).toUpperCase()}
        </p>
      )}
    </div>
  );
}
