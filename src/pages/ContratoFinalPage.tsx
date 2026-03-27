import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Loader2, Mail, RefreshCw, FileText, Eye, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { ErrorBlock } from "@/components/ui/ErrorBlock";
import { resolvePaidContractPdf, type PdfGenerationResult } from "@/lib/postPurchase";
import { downloadPdf } from "@/lib/pdfDownload";
import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";

type ContractState = "checking" | "not_generated" | "available" | "error" | "generating" | "downloading";

const ContratoFinalPage = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ContractState>("checking");
  const [result, setResult] = useState<PdfGenerationResult | null>(null);
  const [lastError, setLastError] = useState<WmtiError | null>(null);
  const [emailing, setEmailing] = useState(false);

  const checkStatus = async () => {
    if (!quoteId) return;
    setState("checking");
    setLastError(null);
    try {
      const response = await resolvePaidContractPdf(quoteId, { generateIfMissing: false });
      setResult(response);
      setState(response.success && response.pdf_url ? "available" : "not_generated");
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "check_contract_status",
        message: "Falha ao verificar status do documento",
        error: err,
        quoteId,
        functionName: "generate-paid-contract-pdf",
      });
      setLastError(wmtiErr);
      setState("error");
    }
  };

  useEffect(() => { checkStatus(); }, [quoteId]);

  const generatePdf = async () => {
    if (!quoteId) return;
    setState("generating");
    setLastError(null);
    try {
      const response = await resolvePaidContractPdf(quoteId, { generateIfMissing: true });
      if (!response.success || !response.pdf_url) {
        throw new Error(response.error || "PDF não foi gerado");
      }
      setResult(response);
      setState("available");
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "generate_contract_pdf",
        message: "Falha ao gerar o contrato PDF",
        error: err,
        quoteId,
        functionName: "generate-paid-contract-pdf",
      });
      setLastError(wmtiErr);
      setState("error");
    }
  };

  const handleDownload = async () => {
    if (!result?.pdf_url || !quoteId) return;
    setState("downloading");
    setLastError(null);
    const fileName = result.file_name || `contrato-wmti-${quoteId.slice(0, 8).toUpperCase()}.pdf`;
    const downloadResult = await downloadPdf(result.pdf_url, fileName, { quoteId });
    if (!downloadResult.success) {
      setLastError(downloadResult.error || null);
      setState("error");
    } else {
      setState("available");
    }
  };

  const handleView = async () => {
    if (!result?.pdf_url) return;
    // Validate before opening
    try {
      const resp = await fetch(result.pdf_url, { method: "HEAD" });
      if (!resp.ok) {
        const wmtiErr = await logAndPersistError({
          action: "view_contract_pdf",
          message: `Arquivo não acessível (HTTP ${resp.status})`,
          httpStatus: resp.status,
          quoteId,
          functionName: "view_contract",
        });
        setLastError(wmtiErr);
        setState("error");
        return;
      }
    } catch {
      // HEAD may fail due to CORS, try opening directly
    }
    window.open(result.pdf_url, "_blank", "noopener,noreferrer");
  };

  const handleEmail = async () => {
    if (!quoteId) return;
    setEmailing(true);
    setLastError(null);
    try {
      const response = await resolvePaidContractPdf(quoteId, { generateIfMissing: true, sendEmail: true });
      if (!response.success) throw new Error(response.error || "Falha ao enviar");
      setResult(response);
      if (response.pdf_url) setState("available");
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "email_contract_pdf",
        message: "Falha ao reenviar contrato por e-mail",
        error: err,
        quoteId,
        functionName: "generate-paid-contract-pdf",
      });
      setLastError(wmtiErr);
    } finally {
      setEmailing(false);
    }
  };

  const stateLabel: Record<ContractState, string> = {
    checking: "Verificando status do documento...",
    not_generated: "Documento ainda não gerado",
    available: "Documento pronto",
    error: "Erro no documento",
    generating: "Gerando contrato PDF...",
    downloading: "Preparando download...",
  };

  const isLoading = state === "checking" || state === "generating" || state === "downloading";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead title="Contrato final | WMTi" description="Geração e download do contrato final após pagamento confirmado." />
      <Navbar />

      <main className="section-dark pt-24 md:pt-28 pb-20">
        <div className="container max-w-3xl space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-heading font-bold">Contrato final do pedido</h1>
            <p className="text-sm text-muted-foreground">O documento só é liberado após pagamento confirmado.</p>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-lg space-y-5">
            {/* Status indicator */}
            <div className={`rounded-xl border p-4 text-sm flex items-center gap-3 ${
              state === "error" ? "border-destructive/30 bg-destructive/10" :
              state === "available" ? "border-green-500/30 bg-green-500/10" :
              "border-border bg-muted/30"
            }`}>
              {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
              {state === "error" && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
              <div>
                <p className="font-semibold text-foreground">{stateLabel[state]}</p>
                {state === "available" && result?.reused_existing && (
                  <p className="text-xs text-muted-foreground mt-0.5">Arquivo existente reutilizado.</p>
                )}
                {state === "available" && result?.generated && (
                  <p className="text-xs text-muted-foreground mt-0.5">PDF criado com os dados finais.</p>
                )}
              </div>
            </div>

            {/* Error block with copy */}
            {state === "error" && lastError && (
              <ErrorBlock
                message={lastError.message}
                error={lastError}
                onRetry={result?.pdf_url ? handleDownload : generatePdf}
                retryLabel={result?.pdf_url ? "Tentar download novamente" : "Regenerar contrato"}
              />
            )}

            {/* Action buttons */}
            {!isLoading && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {state === "available" && result?.pdf_url ? (
                  <>
                    <Button onClick={handleView}>
                      <Eye className="mr-2 h-4 w-4" />
                      Visualizar
                    </Button>
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      Baixar contrato
                    </Button>
                  </>
                ) : state !== "error" ? (
                  <Button onClick={generatePdf}>
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar contrato PDF
                  </Button>
                ) : null}

                <Button variant="outline" onClick={generatePdf} disabled={isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerar
                </Button>

                <Button variant="outline" onClick={handleEmail} disabled={emailing}>
                  {emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Reenviar por e-mail
                </Button>

                <Button variant="outline" onClick={() => navigate(`/ativacao-acesso?quote=${quoteId}`)}>
                  Ver acesso liberado
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContratoFinalPage;
