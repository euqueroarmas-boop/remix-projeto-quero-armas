import { motion } from "framer-motion";
import { CheckCircle, Download, Home, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PurchaseSuccessScreen = ({ visible, data }: Props) => {
  const navigate = useNavigate();

  if (!visible) return null;

  const paymentLabel = data.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" : data.paymentMethod === "BOLETO" ? "Boleto Bancário" : data.paymentMethod;
  const contractRef = data.contractId ? data.contractId.slice(0, 8).toUpperCase() : null;

  const handleDownload = () => {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Comprovante de Contratação — WMTi</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.7; padding: 0 20px; }
  .header { text-align: center; border-bottom: 3px solid #FF5A1F; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 22px; margin: 0; color: #FF5A1F; }
  .header p { margin: 4px 0 0; font-size: 12px; color: #666; }
  .badge { display: inline-block; background: #e6f9ed; color: #15803d; font-weight: bold; font-size: 13px; padding: 6px 16px; border-radius: 20px; margin: 20px 0; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #FF5A1F; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  td:first-child { color: #666; width: 40%; }
  td:last-child { font-weight: 600; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<div class="header">
  <h1>WMTi Tecnologia da Informação</h1>
  <p>CNPJ: 13.366.668/0001-07 • Jacareí/SP</p>
</div>

<div style="text-align:center;">
  <div class="badge">✓ PAGAMENTO CONFIRMADO</div>
  <p style="font-size:18px; font-weight:bold; margin:10px 0 0;">Comprovante de Contratação</p>
</div>

<h2>Dados do Contratante</h2>
<table>
  <tr><td>Razão Social / Nome</td><td>${data.customerName}</td></tr>
  <tr><td>CPF / CNPJ</td><td>${data.customerCpfCnpj}</td></tr>
  <tr><td>E-mail</td><td>${data.customerEmail}</td></tr>
</table>

<h2>Detalhes da Contratação</h2>
<table>
  <tr><td>Serviço</td><td>${data.serviceName}</td></tr>
  ${data.hours ? `<tr><td>Quantidade de Horas</td><td>${data.hours}h</td></tr>` : ""}
  ${data.computersQty ? `<tr><td>Computadores</td><td>${data.computersQty}</td></tr>` : ""}
  <tr><td>${data.isRecurring ? "Valor Mensal" : "Valor Pago"}</td><td>${formatCurrency(data.monthlyValue)}</td></tr>
  <tr><td>Forma de Pagamento</td><td>${paymentLabel}</td></tr>
  <tr><td>Data da Contratação</td><td>${data.purchaseDate}</td></tr>
  <tr><td>Status</td><td style="color:#15803d;">Pagamento Confirmado</td></tr>
  ${contractRef ? `<tr><td>Contrato</td><td>${contractRef}</td></tr>` : ""}
</table>

<div class="footer">
  <p>WMTi Tecnologia da Informação LTDA — CNPJ 13.366.668/0001-07</p>
  <p>Rua José Benedito Duarte, 140 — Parque Itamarati — Jacareí/SP — CEP 12.307-200</p>
  <p>Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")}</p>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-wmti-${contractRef || "compra"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const whatsappText = encodeURIComponent(
    `Olá! Acabei de contratar ${data.serviceName}${data.hours ? ` (${data.hours}h)` : ""} no valor de ${formatCurrency(data.monthlyValue)}. ${contractRef ? `Contrato: ${contractRef}` : ""}`
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-card border border-primary/20 rounded-2xl p-6 md:p-10 space-y-8"
    >
      {/* Success header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h3 className="text-2xl md:text-3xl font-heading font-bold">
          Pagamento confirmado com sucesso!
        </h3>
        <p className="text-muted-foreground max-w-md">
          Sua contratação foi concluída. Agradecemos pela confiança na WMTi.
        </p>
        <p className="text-sm text-muted-foreground">
          Em breve entraremos em contato para dar andamento ao atendimento.
        </p>
      </div>

      {/* Purchase summary */}
      <div className="bg-secondary rounded-xl p-5 md:p-6 space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Resumo da compra
        </p>
        <div className="space-y-3 text-sm">
          <SummaryRow label="Serviço" value={data.serviceName} />
          {data.hours && <SummaryRow label="Horas" value={`${data.hours}h`} />}
          {data.computersQty && <SummaryRow label="Computadores" value={String(data.computersQty)} />}
          <SummaryRow label={data.isRecurring ? "Valor mensal" : "Valor pago"} value={formatCurrency(data.monthlyValue)} highlight />
          <SummaryRow label="Contratante" value={data.customerName} />
          <SummaryRow label="CPF/CNPJ" value={data.customerCpfCnpj} />
          <SummaryRow label="E-mail" value={data.customerEmail} />
          <SummaryRow label="Forma de pagamento" value={paymentLabel} />
          <SummaryRow label="Data" value={data.purchaseDate} />
          <SummaryRow label="Status" value="Confirmado" status="success" />
          {contractRef && <SummaryRow label="Contrato" value={contractRef} mono />}
        </div>
      </div>

      {/* Confirmation email notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
        <p className="text-sm text-muted-foreground">
          📧 Um e-mail de confirmação foi enviado para <strong className="text-foreground">{data.customerEmail}</strong>
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button onClick={handleDownload} variant="outline" className="w-full h-12">
          <Download className="w-4 h-4 mr-2" />
          Baixar comprovante da compra
        </Button>
        <Button onClick={() => navigate("/")} variant="outline" className="w-full h-12">
          <Home className="w-4 h-4 mr-2" />
          Voltar para o site
        </Button>
        <a
          href={`https://wa.me/5511963166915?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 h-12 border border-primary/30 text-primary rounded-md hover:bg-primary/5 transition-colors font-mono text-sm"
        >
          <MessageCircle className="w-4 h-4" />
          Falar no WhatsApp
        </a>
      </div>
    </motion.div>
  );
};

const SummaryRow = ({
  label,
  value,
  highlight,
  status,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  status?: "success";
  mono?: boolean;
}) => (
  <div className="flex justify-between items-center">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={`font-semibold ${
        highlight ? "text-primary" : status === "success" ? "text-green-500 font-bold" : mono ? "font-mono text-xs" : ""
      }`}
    >
      {value}
    </span>
  </div>
);

export default PurchaseSuccessScreen;
