import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Download, Home, MessageCircle, Printer, ExternalLink, Loader2, FileText, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ErrorBlock } from "@/components/ui/ErrorBlock";
import { downloadPdf } from "@/lib/pdfDownload";
import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";

interface PurchaseData {
  serviceName: string;
  hours?: number;
  computersQty?: number;
  monthlyValue: number;
  isRecurring?: boolean;
  customerName: string;
  customerCpfCnpj: string;
  customerEmail: string;
  paymentMethod: string;
  contractId?: string | null;
  purchaseDate: string;
}

interface Props {
  visible: boolean;
  data: PurchaseData;
  quoteId: string;
  pdfUrl?: string | null;
  pdfLoading?: boolean;
  pdfReady?: boolean;
  pdfError?: string | null;
  onGeneratePdf: () => void;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PurchaseSuccessScreen = ({ visible, data, quoteId, pdfUrl, pdfLoading, pdfReady, pdfError, onGeneratePdf }: Props) => {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [lastError, setLastError] = useState<WmtiError | null>(null);

  if (!visible) return null;

  const paymentLabel =
    data.paymentMethod === "CREDIT_CARD"
      ? "Cartão de Crédito"
      : data.paymentMethod === "BOLETO"
      ? "Boleto Bancário"
      : data.paymentMethod === "PIX"
      ? "PIX"
      : data.paymentMethod;

  const contractRef = data.contractId
    ? data.contractId.slice(0, 8).toUpperCase()
    : null;

  const whatsappText = encodeURIComponent(
    `Olá! Acabei de contratar ${data.serviceName}${data.hours ? ` (${data.hours}h)` : ""} no valor de ${formatCurrency(data.monthlyValue)}. ${contractRef ? `Contrato: ${contractRef}` : ""}`
  );

  const handleDownloadPdf = async () => {
    if (!pdfUrl) return;
    setDownloading(true);
    setLastError(null);
    const fileName = `contrato-wmti-${contractRef || quoteId.slice(0, 8).toUpperCase()}.pdf`;
    const result = await downloadPdf(pdfUrl, fileName, { quoteId, contractId: data.contractId || undefined });
    if (!result.success && result.error) {
      setLastError(result.error);
    }
    setDownloading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 md:space-y-8 pb-20"
    >
      {/* ── Success Header ── */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center"
        >
          <CheckCircle className="w-12 h-12 text-green-500" />
        </motion.div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-tight">
          Pagamento confirmado com sucesso!
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-md leading-relaxed">
          Sua contratação foi concluída. Agradecemos pela confiança na WMTi.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-card border-2 border-primary/20 rounded-xl overflow-hidden shadow-lg"
      >
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Próximo passo</p>
            <h3 className="font-heading font-bold text-foreground text-sm mt-1">Libere seu acesso ao portal em uma tela separada</h3>
          </div>
          <Button onClick={() => navigate(`/ativacao-acesso?quote=${quoteId}`)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Liberar meu acesso ao portal
          </Button>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">
          O comprovante fica aqui. A entrega do login e da senha temporária agora acontece em uma rota dedicada, sem polling infinito e com recuperação automática do acesso.
        </div>
      </motion.div>

      {/* ── Receipt Card ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        {/* Card Header */}
        <div className="bg-muted/50 border-b border-border px-5 py-4 md:px-6 md:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-heading font-bold text-sm">W</span>
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-foreground text-sm">Comprovante de Compra</p>
              {contractRef && (
                <p className="font-mono text-[11px] text-muted-foreground truncate">
                  Pedido #{contractRef}
                </p>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Confirmado
          </span>
        </div>

        {/* Card Body */}
        <div className="px-5 py-5 md:px-6 md:py-6 space-y-5">
          {/* Service info */}
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-widest text-primary">
              Serviço contratado
            </p>
            <p className="text-foreground font-heading font-bold text-base md:text-lg leading-snug break-words">
              {data.serviceName}
            </p>
          </div>

          {/* Value highlight */}
          <div className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {data.isRecurring ? "Valor mensal" : "Valor pago"}
            </span>
            <span className="text-xl md:text-2xl font-heading font-bold text-primary">
              {formatCurrency(data.monthlyValue)}
            </span>
          </div>

          {/* Detail rows */}
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {data.hours && (
              <DetailRow label="Horas técnicas" value={`${data.hours}h`} />
            )}
            {data.computersQty && (
              <DetailRow label="Computadores" value={String(data.computersQty)} />
            )}
            <DetailRow label="Contratante" value={data.customerName} />
            <DetailRow label="CPF / CNPJ" value={data.customerCpfCnpj} mono />
            <DetailRow label="E-mail" value={data.customerEmail} />
            <DetailRow label="Pagamento" value={paymentLabel} />
            <DetailRow label="Data" value={data.purchaseDate} />
            <DetailRow label="Status" value="Confirmado" status="success" />
            {contractRef && (
              <DetailRow label="Contrato" value={contractRef} mono />
            )}
          </div>
        </div>

        {/* Email notice */}
        <div className="border-t border-border bg-muted/30 px-5 py-3 md:px-6">
          <p className="text-xs text-muted-foreground text-center">
            📧 Confirmação enviada para{" "}
            <strong className="text-foreground">{data.customerEmail}</strong>
          </p>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={pdfReady ? handleDownloadPdf : onGeneratePdf}
          disabled={pdfLoading || downloading}
          className="w-full h-12 text-sm font-semibold"
        >
          {pdfLoading || downloading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : pdfReady ? (
            <Download className="w-4 h-4 mr-2" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          {pdfReady ? "Baixar contrato" : "Gerar contrato PDF"}
        </Button>
        <Button
          onClick={() => window.print()}
          variant="outline"
          className="w-full h-12 text-sm"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir página
        </Button>
        <Button
          onClick={() => navigate("/")}
          variant="outline"
          className="w-full h-12 text-sm"
        >
          <Home className="w-4 h-4 mr-2" />
          Voltar para o site
        </Button>
        <a
          href={`https://wa.me/5511963166915?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 h-12 border border-border text-foreground rounded-md hover:bg-muted transition-colors text-sm"
        >
          <MessageCircle className="w-4 h-4" />
          Falar no WhatsApp
        </a>
      </div>

      {(pdfError || lastError) && (
        <ErrorBlock
          message={pdfError || lastError?.message || "Erro ao processar o contrato"}
          error={lastError}
          onRetry={pdfReady ? handleDownloadPdf : onGeneratePdf}
          retryLabel="Tentar novamente"
        />
      )}
    </motion.div>
  );
};

/** Single detail row with responsive label/value layout */
const DetailRow = ({
  label,
  value,
  mono,
  status,
}: {
  label: string;
  value: string;
  mono?: boolean;
  status?: "success";
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 px-4 py-2.5 even:bg-muted/20">
    <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    <span
      className={`text-sm font-semibold text-right break-words ${
        status === "success"
          ? "text-green-400"
          : mono
          ? "font-mono text-xs text-foreground"
          : "text-foreground"
      }`}
    >
      {value}
    </span>
  </div>
);

export default PurchaseSuccessScreen;
