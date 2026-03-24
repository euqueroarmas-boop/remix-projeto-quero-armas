import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Loader2, Mail, RefreshCw, FileText } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { resolvePaidContractPdf, type PdfGenerationResult } from "@/lib/postPurchase";

const ContratoFinalPage = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [result, setResult] = useState<PdfGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await resolvePaidContractPdf(quoteId, { generateIfMissing: false });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível verificar o documento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [quoteId]);

  const generatePdf = async (sendEmail = false) => {
    if (!quoteId) return;
    setError(null);
    sendEmail ? setEmailing(true) : setGenerating(true);
    try {
      const response = await resolvePaidContractPdf(quoteId, { generateIfMissing: true, sendEmail });
      setResult(response);
      if (response.pdf_url) {
        window.open(response.pdf_url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o PDF final.");
    } finally {
      setGenerating(false);
      setEmailing(false);
    }
  };

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
            <p className="text-sm text-muted-foreground">O documento só é liberado após pagamento confirmado. Se já existir, o sistema reutiliza o arquivo; se não existir, gera agora.</p>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-lg space-y-5">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Verificando status do documento...
              </div>
            ) : error ? (
              <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="font-semibold">Não foi possível concluir a operação</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={() => generatePdf(false)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Tentar novamente
                  </Button>
                  <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  <p className="font-semibold text-foreground">
                    {result?.pdf_url ? "Documento pronto para download" : "Documento ainda não gerado"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {result?.reused_existing ? "Arquivo existente localizado e reutilizado com segurança." : result?.generated ? "PDF criado com os dados finais do pagamento e do acesso ao portal." : "Você pode gerar o PDF sob demanda agora."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {result?.pdf_url ? (
                    <a href={result.pdf_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
                      <Download className="mr-2 h-4 w-4" />
                      Baixar contrato
                    </a>
                  ) : (
                    <Button onClick={() => generatePdf(false)} disabled={generating || emailing}>
                      {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Gerar contrato PDF
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => generatePdf(false)} disabled={generating || emailing}>
                    {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Tentar novamente
                  </Button>

                  <Button variant="outline" onClick={() => generatePdf(true)} disabled={generating || emailing}>
                    {emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Reenviar por e-mail
                  </Button>

                  <Button variant="outline" onClick={() => navigate(`/ativacao-acesso?quote=${quoteId}`)}>
                    Ver acesso liberado
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default ContratoFinalPage;