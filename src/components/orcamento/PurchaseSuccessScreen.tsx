import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CheckCircle, Download, Home, MessageCircle, Printer, ExternalLink, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ErrorBlock } from "@/components/ui/ErrorBlock";
import { downloadPdf } from "@/lib/pdfDownload";
import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";
import { openWhatsAppRaw } from "@/lib/whatsapp";

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
  pdfLoading?: boolean;
  pdfReady?: boolean;
  pdfError?: string | null;
  onGeneratePdf: () => void;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PurchaseSuccessScreen = ({ visible, data, quoteId, pdfLoading, pdfReady, pdfError, onGeneratePdf }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [lastError, setLastError] = useState<WmtiError | null>(null);

  if (!visible) return null;

  const paymentLabel =
    data.paymentMethod === "CREDIT_CARD" ? t("purchaseSuccess.creditCard")
    : data.paymentMethod === "BOLETO" ? t("purchaseSuccess.boletoLabel")
    : data.paymentMethod === "PIX" ? t("purchaseSuccess.pix")
    : data.paymentMethod;

  const contractRef = data.contractId ? data.contractId.slice(0, 8).toUpperCase() : null;

  const whatsappRawMsg = `${t("purchaseSuccess.whatsapp")} — ${data.serviceName}${data.hours ? ` (${data.hours}h)` : ""} — ${formatCurrency(data.monthlyValue)}${contractRef ? ` — ${contractRef}` : ""}`;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setLastError(null);
    const fileName = `contrato-wmti-${contractRef || quoteId.slice(0, 8).toUpperCase()}.pdf`;
    const result = await downloadPdf(fileName, { quoteId, contractId: data.contractId || undefined });
    if (!result.success && result.error) setLastError(result.error);
    setDownloading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2, stiffness: 200 }} className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </motion.div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-tight">{t("purchaseSuccess.title")}</h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-md leading-relaxed">{t("purchaseSuccess.desc")}</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border-2 border-primary/20 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">{t("purchaseSuccess.nextStep")}</p>
            <h3 className="font-heading font-bold text-foreground text-sm mt-1">{t("purchaseSuccess.portalAccess")}</h3>
          </div>
          <Button onClick={() => navigate(`/ativacao-acesso?quote=${quoteId}`)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {t("purchaseSuccess.portalBtn")}
          </Button>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">{t("purchaseSuccess.portalHint")}</div>
      </motion.div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        <div className="bg-muted/50 border-b border-border px-5 py-4 md:px-6 md:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-heading font-bold text-sm">W</span>
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-foreground text-sm">{t("purchaseSuccess.receipt")}</p>
              {contractRef && <p className="font-mono text-[11px] text-muted-foreground truncate">{t("purchaseSuccess.order")} #{contractRef}</p>}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {t("purchaseSuccess.confirmed")}
          </span>
        </div>

        <div className="px-5 py-5 md:px-6 md:py-6 space-y-5">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-widest text-primary">{t("purchaseSuccess.serviceHired")}</p>
            <p className="text-foreground font-heading font-bold text-base md:text-lg leading-snug break-words">{data.serviceName}</p>
          </div>

          <div className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">{data.isRecurring ? t("purchaseSuccess.monthlyValue") : t("purchaseSuccess.amountPaid")}</span>
            <span className="text-xl md:text-2xl font-heading font-bold text-primary">{formatCurrency(data.monthlyValue)}</span>
          </div>

          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {data.hours && <DetailRow label={t("purchaseSuccess.techHours")} value={`${data.hours}h`} />}
            {data.computersQty && <DetailRow label={t("purchaseSuccess.computers")} value={String(data.computersQty)} />}
            <DetailRow label={t("purchaseSuccess.contractor")} value={data.customerName} />
            <DetailRow label={t("purchaseSuccess.cpfCnpj")} value={data.customerCpfCnpj} mono />
            <DetailRow label={t("purchaseSuccess.emailLabel")} value={data.customerEmail} />
            <DetailRow label={t("purchaseSuccess.payment")} value={paymentLabel} />
            <DetailRow label={t("purchaseSuccess.date")} value={data.purchaseDate} />
            <DetailRow label={t("purchaseSuccess.status")} value={t("purchaseSuccess.confirmed")} status="success" />
            {contractRef && <DetailRow label={t("purchaseSuccess.contract")} value={contractRef} mono />}
          </div>
        </div>

        <div className="border-t border-border bg-muted/30 px-5 py-3 md:px-6">
          <p className="text-xs text-muted-foreground text-center">
            📧 {t("purchaseSuccess.emailSent")} <strong className="text-foreground">{data.customerEmail}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button onClick={pdfReady ? handleDownloadPdf : onGeneratePdf} disabled={pdfLoading || downloading} className="w-full h-12 text-sm font-semibold">
          {pdfLoading || downloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : pdfReady ? <Download className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
          {pdfReady ? t("purchaseSuccess.downloadContract") : t("purchaseSuccess.generatePdf")}
        </Button>
        <Button onClick={() => window.print()} variant="outline" className="w-full h-12 text-sm">
          <Printer className="w-4 h-4 mr-2" />
          {t("purchaseSuccess.print")}
        </Button>
        <Button onClick={() => navigate("/")} variant="outline" className="w-full h-12 text-sm">
          <Home className="w-4 h-4 mr-2" />
          {t("purchaseSuccess.backToSite")}
        </Button>
        <button onClick={() => openWhatsAppRaw(whatsappRawMsg)} className="w-full inline-flex items-center justify-center gap-2 h-12 border border-border text-foreground rounded-md hover:bg-muted transition-colors text-sm">
          <MessageCircle className="w-4 h-4" />
          {t("purchaseSuccess.whatsapp")}
        </button>
      </div>

      {(pdfError || lastError) && (
        <ErrorBlock message={pdfError || lastError?.message || ""} error={lastError} onRetry={pdfReady ? handleDownloadPdf : onGeneratePdf} retryLabel={t("paymentSelector.retry")} />
      )}
    </motion.div>
  );
};

const DetailRow = ({ label, value, mono, status }: { label: string; value: string; mono?: boolean; status?: "success" }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 px-4 py-2.5 even:bg-muted/20">
    <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    <span className={`text-sm font-semibold text-right break-words ${status === "success" ? "text-green-400" : mono ? "font-mono text-xs text-foreground" : "text-foreground"}`}>{value}</span>
  </div>
);

export default PurchaseSuccessScreen;
