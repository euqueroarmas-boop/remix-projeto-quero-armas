import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import { ContractStatusCard } from "@/components/contrato-final/ContractStatusCard";
import { resolvePaidContractPdf, type PdfGenerationResult } from "@/lib/postPurchase";
import { downloadPdf, viewPdf } from "@/lib/pdfDownload";
import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";
import { supabase } from "@/integrations/supabase/client";

export type OrderStatus =
  | "loading"
  | "awaiting_payment"
  | "processing_payment"
  | "generating_contract"
  | "ready"
  | "technical_error";

export interface OrderContext {
  status: OrderStatus;
  paymentMethod?: string;
  paymentStatus?: string;
  pdfResult?: PdfGenerationResult | null;
  lastError?: WmtiError | null;
  emailing?: boolean;
}

const ContratoFinalPage = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<OrderContext>({ status: "loading" });

  // Fetch payment info + contract status
  const loadStatus = async () => {
    if (!quoteId) return;
    setCtx((p) => ({ ...p, status: "loading", lastError: null }));

    try {
      // Fetch payment info
      const { data: payment } = await supabase
        .from("payments")
        .select("payment_status, billing_type, payment_method")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const paymentStatus = payment?.payment_status || "PENDING";
      const paymentMethod = payment?.billing_type || payment?.payment_method || "BOLETO";
      const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentStatus);

      // Check PDF
      const pdfResult = await resolvePaidContractPdf(quoteId, { generateIfMissing: false });

      let status: OrderStatus;
      if (pdfResult.success && pdfResult.has_pdf) {
        status = "ready";
      } else if (!isPaid) {
        status = "awaiting_payment";
      } else {
        status = "processing_payment";
      }

      setCtx({ status, paymentMethod, paymentStatus, pdfResult });
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "check_order_status",
        message: "Falha ao verificar status do pedido",
        error: err,
        quoteId,
        functionName: "generate-paid-contract-pdf",
      });
      setCtx((p) => ({ ...p, status: "technical_error", lastError: wmtiErr }));
    }
  };

  useEffect(() => { loadStatus(); }, [quoteId]);

  const handleGenerateContract = async () => {
    if (!quoteId) return;
    setCtx((p) => ({ ...p, status: "generating_contract", lastError: null }));
    try {
      const result = await resolvePaidContractPdf(quoteId, { generateIfMissing: true });
      if (!result.success) throw new Error(result.error || "Contrato não gerado");
      setCtx((p) => ({ ...p, status: "ready", pdfResult: result }));
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "generate_contract_pdf",
        message: "Falha ao gerar contrato",
        error: err,
        quoteId,
        functionName: "generate-paid-contract-pdf",
      });
      setCtx((p) => ({ ...p, status: "technical_error", lastError: wmtiErr }));
    }
  };

  const handleDownload = async () => {
    if (!quoteId) return;
    const fileName = ctx.pdfResult?.file_name || `contrato-wmti-${quoteId.slice(0, 8).toUpperCase()}.pdf`;
    const result = await downloadPdf(fileName, { quoteId });
    if (!result.success && result.error) {
      setCtx((p) => ({ ...p, status: "technical_error", lastError: result.error }));
    }
  };

  const handleView = async () => {
    if (!quoteId) return;
    const result = await viewPdf({ quoteId });
    if (!result.success && result.error) {
      setCtx((p) => ({ ...p, status: "technical_error", lastError: result.error }));
    }
  };

  const handleEmail = async () => {
    if (!quoteId) return;
    setCtx((p) => ({ ...p, emailing: true, lastError: null }));
    try {
      const result = await resolvePaidContractPdf(quoteId, { generateIfMissing: true, sendEmail: true });
      if (!result.success) throw new Error(result.error || "Falha ao enviar");
      setCtx((p) => ({ ...p, emailing: false, pdfResult: result, status: result.has_pdf ? "ready" : p.status }));
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "email_contract_pdf",
        message: "Falha ao enviar contrato por e-mail",
        error: err,
        quoteId,
        functionName: "generate-paid-contract-pdf",
      });
      setCtx((p) => ({ ...p, emailing: false, lastError: wmtiErr }));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead title="Status do Pedido | WMTi" description="Acompanhe o status do seu pedido e contrato." />
      <Navbar />

      <main className="section-dark pt-24 md:pt-28 pb-20">
        <div className="container max-w-2xl">
          <ContractStatusCard
            ctx={ctx}
            quoteId={quoteId || ""}
            onRetry={loadStatus}
            onGenerate={handleGenerateContract}
            onDownload={handleDownload}
            onView={handleView}
            onEmail={handleEmail}
            onGoToPayment={() => navigate(`/compra-concluida?quote=${quoteId}`)}
            onGoToAccess={() => navigate(`/ativacao-acesso?quote=${quoteId}`)}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContratoFinalPage;
