import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import PurchaseSuccessScreen from "@/components/orcamento/PurchaseSuccessScreen";
import { Loader2 } from "lucide-react";
import { fetchPurchaseInfo, readPurchaseInfoFromSession, resolvePaidContractPdf, type PurchaseInfo } from "@/lib/postPurchase";

const CompraConcluida = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("quote");
  const [data, setData] = useState<PurchaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const sessionData = readPurchaseInfoFromSession();
    if (sessionData) {
      setData(sessionData);
      setLoading(false);
      return;
    }

    if (!quoteId) {
      setError(true);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const purchase = await fetchPurchaseInfo(quoteId);
        setData(purchase);
      } catch (err) {
        console.error("[WMTi] Erro ao carregar dados da compra:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [quoteId]);

  // Check if PDF already exists (without generating)
  useEffect(() => {
    if (!quoteId) return;
    resolvePaidContractPdf(quoteId, { generateIfMissing: false })
      .then((result) => {
        if (result.success && result.has_pdf) {
          setPdfReady(true);
        }
      })
      .catch((err) => {
        console.error("[WMTi] Erro ao consultar PDF:", err);
      });
  }, [quoteId]);

  const handleGeneratePdf = async () => {
    if (!quoteId) return;
    setPdfLoading(true);
    setPdfError(null);

    try {
      const result = await resolvePaidContractPdf(quoteId, { generateIfMissing: true });
      if (!result.success) {
        throw new Error(result.error || "Não foi possível gerar o contrato PDF.");
      }
      setPdfReady(true);
      // Navigate to the dedicated contract page (WMTi domain route)
      navigate(`/contrato-final/${quoteId}`);
    } catch (err) {
      console.error("[WMTi] Erro ao gerar PDF:", err);
      setPdfError(err instanceof Error ? err.message : "Falha ao gerar o PDF final.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SeoHead title="Compra Concluída | WMTi" description="Sua contratação foi concluída com sucesso." />
      <Navbar />

      <section className="section-dark pt-24 md:pt-28 pb-16">
        <div className="container max-w-3xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Carregando dados da compra...</p>
            </div>
          ) : error || !data ? (
            <div className="text-center py-20 space-y-4">
              <p className="text-lg font-heading font-bold text-foreground">Dados da compra não encontrados</p>
              <p className="text-sm text-muted-foreground">O link pode ter expirado ou ser inválido.</p>
              <button
                onClick={() => navigate("/")}
                className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-sm rounded hover:brightness-110 transition-all"
              >
                Voltar para o site
              </button>
            </div>
          ) : (
            <PurchaseSuccessScreen
              visible
              data={data}
              quoteId={quoteId || ""}
              pdfLoading={pdfLoading}
              pdfReady={pdfReady}
              pdfError={pdfError}
              onGeneratePdf={handleGeneratePdf}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CompraConcluida;
