import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle, ExternalLink, Download, Copy, Eye, EyeOff,
  ChevronRight, Loader2, AlertTriangle, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { generateReceiptPdf } from "@/components/orcamento/generateReceiptPdf";
import { useToast } from "@/hooks/use-toast";

export interface PurchaseSummaryData {
  serviceName: string;
  hours?: number;
  totalValue: number;
  customerName: string;
  customerEmail: string;
  customerCpfCnpj: string;
  paymentMethod: "BOLETO" | "CREDIT_CARD" | string;
  contractRef?: string | null;
  purchaseDate: string;
}

export interface PortalCredentials {
  email: string;
  temp_password: string;
  password_change_required?: boolean;
}

interface Props {
  data: PurchaseSummaryData;
  credentials: PortalCredentials | null;
  credentialsLoading?: boolean;
  credentialsError?: string | null;
  invoiceUrl?: string | null;
  isBoleto?: boolean;
  onRetryCredentials?: () => void;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PurchaseSummaryCard = ({
  data,
  credentials,
  credentialsLoading,
  credentialsError,
  invoiceUrl,
  isBoleto,
  onRetryCredentials,
}: Props) => {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const paymentLabel =
    data.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito"
    : data.paymentMethod === "BOLETO" ? "Boleto Bancário"
    : data.paymentMethod === "PIX" ? "PIX"
    : data.paymentMethod;

  const contractRef = data.contractRef?.slice(0, 8).toUpperCase() || null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!`, duration: 2000 });
  };

  const handleDownloadReceipt = () => {
    generateReceiptPdf({
      serviceName: data.serviceName,
      hours: data.hours,
      monthlyValue: data.totalValue,
      isRecurring: false,
      customerName: data.customerName,
      customerCpfCnpj: data.customerCpfCnpj,
      customerEmail: data.customerEmail,
      paymentMethod: data.paymentMethod,
      contractId: data.contractRef,
      purchaseDate: data.purchaseDate,
      loginEmail: credentials?.email,
      tempPassword: credentials?.temp_password,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
        <h4 className="text-xl font-heading font-bold text-foreground">
          {isBoleto ? "Pedido registrado com sucesso!" : "Compra concluída com sucesso!"}
        </h4>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isBoleto
            ? "Seu contrato e cadastro foram gerados. Após a compensação do boleto, o serviço será ativado automaticamente."
            : "Seu pagamento foi confirmado e o serviço está sendo ativado."}
        </p>
      </div>

      {/* Order Summary */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="bg-muted/50 border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-heading font-bold text-foreground">Resumo do Pedido</span>
          </div>
          {contractRef && (
            <span className="font-mono text-xs text-muted-foreground">#{contractRef}</span>
          )}
        </div>
        <div className="divide-y divide-border">
          <SummaryRow label="Serviço" value={data.serviceName} />
          {data.hours && <SummaryRow label="Horas técnicas" value={`${data.hours}h`} />}
          <SummaryRow label="Valor" value={formatCurrency(data.totalValue)} highlight />
          <SummaryRow label="Pagamento" value={paymentLabel} />
          <SummaryRow label="Data" value={data.purchaseDate} />
          <SummaryRow label="Contratante" value={data.customerName} />
          <SummaryRow label="E-mail" value={data.customerEmail} />
          <SummaryRow
            label="Status"
            value={isBoleto ? "Aguardando compensação" : "Pagamento confirmado"}
            status={isBoleto ? "warning" : "success"}
          />
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-card border-2 border-primary/20 rounded-xl overflow-hidden">
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-3">
          <span className="text-sm font-heading font-bold text-foreground">Credenciais do Portal do Cliente</span>
        </div>
        <div className="px-5 py-4">
          {credentialsLoading ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Gerando credenciais de acesso...</span>
            </div>
          ) : credentialsError ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{credentialsError}</p>
              </div>
              {onRetryCredentials && (
                <Button onClick={onRetryCredentials} variant="outline" size="sm" className="w-full">
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : credentials ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Login (e-mail)</p>
                  <p className="text-sm font-semibold text-foreground font-mono">{credentials.email}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(credentials.email, "E-mail")}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Senha temporária</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {showPassword ? credentials.temp_password : "••••••••"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(credentials.temp_password, "Senha")}
                    className="p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs text-amber-300 font-semibold">⚠️ Troque sua senha no primeiro acesso.</p>
                <p className="text-xs text-muted-foreground mt-1">Esta senha é temporária e deverá ser alterada obrigatoriamente.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-3">
              {isBoleto
                ? "As credenciais serão geradas após a compensação do boleto."
                : "Credenciais em preparação..."}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isBoleto && invoiceUrl && (
          <Button
            onClick={() => window.open(invoiceUrl, "_blank", "noopener,noreferrer")}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir boleto / 2ª via
          </Button>
        )}
        <Link to="/area-do-cliente" className="w-full">
          <Button variant="outline" className="w-full h-12">
            <ChevronRight className="w-4 h-4 mr-2" />
            Acessar Portal do Cliente
          </Button>
        </Link>
        <Button onClick={handleDownloadReceipt} variant="outline" className="w-full h-12">
          <Download className="w-4 h-4 mr-2" />
          Baixar comprovante PDF
        </Button>
      </div>
    </motion.div>
  );
};

const SummaryRow = ({
  label,
  value,
  highlight,
  status,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  status?: "success" | "warning";
}) => (
  <div className="flex items-center justify-between gap-4 px-5 py-2.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={`text-sm font-semibold text-right ${
        status === "success"
          ? "text-green-400"
          : status === "warning"
            ? "text-amber-400"
            : highlight
              ? "text-primary"
              : "text-foreground"
      }`}
    >
      {value}
    </span>
  </div>
);

export default PurchaseSummaryCard;
