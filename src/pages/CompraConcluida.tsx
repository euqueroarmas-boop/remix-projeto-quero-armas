import { useEffect, useState, useRef } from "react";
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

interface ClientCredentials {
  email: string;
  temp_password: string;
  password_change_required: boolean;
}

const CompraConcluida = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("quote");
  const [data, setData] = useState<PurchaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [credentials, setCredentials] = useState<ClientCredentials | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const credentialsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch purchase data
  useEffect(() => {
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
        const { data: quote, error: qErr } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", quoteId)
          .single();
        if (qErr || !quote) throw new Error("Quote not found");

        const { data: contract } = await supabase
          .from("contracts")
          .select("id, contract_type, customer_id")
          .eq("quote_id", quoteId)
          .single();

        let customer: any = null;
        if (contract?.customer_id) {
          const { data: cust } = await supabase
            .from("customers")
            .select("*")
            .eq("id", contract.customer_id)
            .single();
          customer = cust;
        }

        const { data: payment } = await supabase
          .from("payments")
          .select("*")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const contractType = contract?.contract_type || "";
        const isLocacao = contractType === "locacao";
        const isHoras = contractType === "horas-tecnicas";

        const serviceName = isLocacao
          ? "Locação de Equipamentos"
          : isHoras
          ? `Pacote de ${quote.computers_qty || 1} hora(s) técnicas`
          : quote.selected_plan || "Serviços de TI";

        setData({
          serviceName,
          hours: isHoras ? quote.computers_qty || undefined : undefined,
          computersQty: isLocacao ? quote.computers_qty || undefined : undefined,
          monthlyValue: quote.monthly_value || 0,
          isRecurring: isLocacao,
          customerName: customer?.razao_social || "Cliente",
          customerCpfCnpj: customer?.cnpj_ou_cpf || "",
          customerEmail: customer?.email || "",
          paymentMethod: payment?.billing_type || payment?.payment_method || "CREDIT_CARD",
          contractId: contract?.id || null,
          purchaseDate: new Date(quote.created_at).toLocaleDateString("pt-BR"),
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

  // Poll for client credentials
  useEffect(() => {
    if (!quoteId) {
      setCredentialsLoading(false);
      return;
    }

    const fetchCredentials = async () => {
      try {
        const { data: result, error: fnErr } = await supabase.functions.invoke("get-client-credentials", {
          body: { quote_id: quoteId },
        });

        if (fnErr) {
          console.error("[WMTi] Erro ao buscar credenciais:", fnErr);
          return false;
        }

        if (result?.success && result?.temp_password) {
          setCredentials({
            email: result.email,
            temp_password: result.temp_password,
            password_change_required: result.password_change_required,
          });
          setCredentialsLoading(false);
          return true;
        }

        return false;
      } catch (err) {
        console.error("[WMTi] Erro ao buscar credenciais:", err);
        return false;
      }
    };

    // Try immediately
    fetchCredentials().then((found) => {
      if (found) return;

      // Poll every 5s for up to 2 minutes
      let attempts = 0;
      credentialsPollRef.current = setInterval(async () => {
        attempts++;
        const found = await fetchCredentials();
        if (found || attempts >= 24) {
          if (credentialsPollRef.current) clearInterval(credentialsPollRef.current);
          setCredentialsLoading(false);
        }
      }, 5000);
    });

    return () => {
      if (credentialsPollRef.current) clearInterval(credentialsPollRef.current);
    };
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
            <PurchaseSuccessScreen
              visible
              data={data}
              credentials={credentials}
              credentialsLoading={credentialsLoading}
            />
          )}
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default CompraConcluida;
