import jsPDF from "jspdf";

interface ReceiptData {
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
  loginEmail?: string;
  tempPassword?: string;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getPaymentLabel = (method: string) => {
  if (method === "CREDIT_CARD") return "Cartão de Crédito";
  if (method === "BOLETO") return "Boleto Bancário";
  if (method === "PIX") return "PIX";
  return method;
};

export function generateReceiptPdf(data: ReceiptData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ── Header ──
  doc.setFillColor(20, 24, 33);
  doc.rect(0, 0, pageWidth, 52, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 90, 31);
  doc.text("WMTi", margin, y + 10);

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text("Tecnologia da Informação", margin + 25, y + 10);

  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("CNPJ: 13.366.668/0001-07", margin, y + 18);
  doc.text("Jacareí/SP", margin, y + 23);

  // Status badge
  const badgeText = "PAGAMENTO CONFIRMADO";
  doc.setFillColor(34, 120, 60);
  doc.roundedRect(pageWidth - margin - 60, y + 4, 60, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageWidth - margin - 30, y + 11, { align: "center" });

  y = 60;

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text("Comprovante de Contratação", margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  const contractRef = data.contractId ? data.contractId.slice(0, 8).toUpperCase() : null;
  doc.text(`Data: ${data.purchaseDate}${contractRef ? `  •  Pedido: ${contractRef}` : ""}`, margin, y);
  y += 10;

  // ── Separator ──
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Client Data Section ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 90, 31);
  doc.text("DADOS DO CONTRATANTE", margin, y);
  y += 8;

  const clientRows = [
    ["Razão Social / Nome", data.customerName],
    ["CPF / CNPJ", data.customerCpfCnpj],
    ["E-mail", data.customerEmail],
  ];

  clientRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(value, contentWidth - 60);
    doc.text(lines, margin + 60, y);
    y += lines.length * 5 + 3;
  });

  y += 4;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Service Details Section ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 90, 31);
  doc.text("DETALHES DA CONTRATAÇÃO", margin, y);
  y += 8;

  const serviceRows: [string, string][] = [
    ["Serviço", data.serviceName],
  ];
  if (data.hours) serviceRows.push(["Quantidade de Horas", `${data.hours}h`]);
  if (data.computersQty) serviceRows.push(["Computadores", String(data.computersQty)]);
  serviceRows.push([
    data.isRecurring ? "Valor Mensal" : "Valor Pago",
    formatCurrency(data.monthlyValue),
  ]);
  serviceRows.push(["Forma de Pagamento", getPaymentLabel(data.paymentMethod)]);
  serviceRows.push(["Data da Contratação", data.purchaseDate]);
  serviceRows.push(["Status", "Pagamento Confirmado"]);
  if (contractRef) serviceRows.push(["Contrato", contractRef]);

  serviceRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 4, contentWidth, 8, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label, margin + 2, y);

    doc.setFont("helvetica", "bold");
    if (label.includes("Valor")) {
      doc.setTextColor(255, 90, 31);
    } else if (label === "Status") {
      doc.setTextColor(34, 120, 60);
    } else {
      doc.setTextColor(40, 40, 40);
    }
    const lines = doc.splitTextToSize(value, contentWidth - 62);
    doc.text(lines, margin + 60, y);
    y += lines.length * 5 + 4;
  });

  y += 4;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Client Access Credentials ──
  if (data.loginEmail && data.tempPassword) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 90, 31);
    doc.text("DADOS DE ACESSO AO PORTAL DO CLIENTE", margin, y);
    y += 8;

    const credRows: [string, string][] = [
      ["Login (e-mail)", data.loginEmail],
      ["Senha temporária", data.tempPassword],
      ["Portal", "wmti.com.br/area-do-cliente"],
    ];

    credRows.forEach(([label, value], i) => {
      if (i % 2 === 0) {
        doc.setFillColor(255, 250, 240);
        doc.rect(margin, y - 4, contentWidth, 8, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(label, margin + 2, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(value, margin + 60, y);
      y += 8;
    });

    y += 2;

    // Security warning
    doc.setFillColor(255, 243, 205);
    doc.roundedRect(margin, y - 2, contentWidth, 14, 2, 2, "F");
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y - 2, contentWidth, 14, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 70, 0);
    doc.text("AVISO DE SEGURANÇA:", margin + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Esta senha é temporária e deverá ser alterada obrigatoriamente no primeiro acesso.", margin + 4, y + 9);

    y += 20;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // ── Footer ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text("WMTi Tecnologia da Informação LTDA — CNPJ 13.366.668/0001-07", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text("Rua José Benedito Duarte, 140 — Parque Itamarati — Jacareí/SP — CEP 12.307-200", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, y, { align: "center" });

  // Save
  const filename = `comprovante-wmti-${contractRef || "compra"}.pdf`;

  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 250);
  } catch {
    doc.save(filename);
  }
}
