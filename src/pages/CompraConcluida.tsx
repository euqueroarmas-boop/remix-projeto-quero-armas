import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import PurchaseSuccessScreen from "@/components/orcamento/PurchaseSuccessScreen";
import { Loader2 } from "lucide-react";

interface PurchaseInfo {
  serviceName: string;
  hours?: number;
  computersQty?: number;
  monthlyValue: number;
  isRecurring: boolean;
  customerName: string;
  customerCpfCnpj: string;
  customerEmail: string;
  paymentMethod: string;
  contractId: string | null;
  purchaseDate: string;
}

const CompraConcluida = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("quote");
  const [data, setData] = useState<PurchaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Try session fallback first
    const sessionRaw = sessionStorage.getItem("wmti_purchase_data");
    if (sessionRaw) {
      try {
        const parsed = JSON.parse(sessionRaw);
        setData(parsed);
        setLoading(false);
        sessionStorage.removeItem("wmti_purchase_data");
        return;
      } catch { /* fall through to DB */ }
    }

    if (!quoteId) {
      setError(true);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch quote
        const { data: quote, error: qErr } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", quoteId)
          .single();
        if (qErr || !quote) throw new Error("Quote not found");

        // Fetch contract
        const { data: contract } = await supabase
          .from("contracts" as any)
          .select("id, contract_type, customer_id")
          .eq("quote_id", quoteId)
          .single();

        // Fetch customer
        let customer: any = null;
        if (contract?.customer_id) {
          const { data: cust } = await supabase
            .from("customers" as any)
            .select("*")
            .eq("id", (contract as any).customer_id)
            .single();
          customer = cust;
        }

        // Fetch payment
        const { data: payment } = await supabase
          .from("payments")
          .select("*")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const contractType = (contract as any)?.contract_type || "";
        const isLocacao = contractType === "locacao";
        const isHoras = contractType === "horas-tecnicas";

        const serviceName = isLocacao
          ? "Locação de Equipamentos"
          : isHoras
          ? `Pacote de ${(quote as any).computers_qty || 1} hora(s) técnicas`
          : (quote as any).selected_plan || "Serviços de TI";

        setData({
          serviceName,
          hours: isHoras ? (quote as any).computers_qty || undefined : undefined,
          computersQty: isLocacao ? (quote as any).computers_qty || undefined : undefined,
          monthlyValue: (quote as any).monthly_value || 0,
          isRecurring: isLocacao,
          customerName: customer?.razao_social || "Cliente",
          customerCpfCnpj: customer?.cnpj_ou_cpf || "",
          customerEmail: customer?.email || "",
          paymentMethod: (payment as any)?.billing_type || (payment as any)?.payment_method || "CREDIT_CARD",
          contractId: (contract as any)?.id || null,
          purchaseDate: new Date((quote as any).created_at).toLocaleDateString("pt-BR"),
        });
      } catch (err) {
        console.error("[WMTi] Erro ao carregar dados da compra:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [quoteId]);

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
            <PurchaseSuccessScreen visible data={data} />
          )}
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default CompraConcluida;
