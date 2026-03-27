import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import ClientLogin from "@/components/area-cliente/ClientLogin";
import ClientPortal from "@/components/area-cliente/ClientPortal";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { logSistema } from "@/lib/logSistema";
import { useTranslation } from "react-i18next";

export interface CustomerData {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_ou_cpf: string;
  email: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  cep: string | null;
  responsavel: string;
}

const AreaDoClientePage = () => {
  const { t } = useTranslation();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // Fetch linked customer
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", sess.user.id)
          .maybeSingle();

        if (data) {
          setCustomer(data as CustomerData);
        } else {
          // Try matching by email
          const { data: emailMatch } = await supabase
            .from("customers")
            .select("*")
            .eq("email", sess.user.email || "")
            .maybeSingle();

          if (emailMatch) {
            // Auto-link user_id
            await supabase
              .from("customers")
              .update({ user_id: sess.user.id })
              .eq("id", emailMatch.id);
            setCustomer(emailMatch as CustomerData);
          }
        }
        logSistema({ tipo: "admin", status: "info", mensagem: "Acesso à Área do Cliente", payload: { user_id: sess.user.id } });
      } else {
        setCustomer(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (!sess) {
        setLoading(false);
      }
      // onAuthStateChange will handle the rest
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    // Session will be picked up by onAuthStateChange
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCustomer(null);
    setSession(null);
    logSistema({ tipo: "admin", status: "info", mensagem: "Logout da Área do Cliente" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title="Área do Cliente | WMTi Tecnologia da Informação"
        description="Portal do cliente WMTi — acompanhe serviços, chamados, financeiro, contratos e documentos fiscais."
        canonical="/area-do-cliente"
      />
      {!session && <Navbar />}
      <main className="min-h-screen bg-background">
        {!session ? (
          <ClientLogin onLogin={handleLogin} />
        ) : customer ? (
          <ClientPortal customer={customer} onLogout={handleLogout} />
        ) : (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
             <p className="text-foreground text-center">{t("clientPortal.unlinkedTitle")}</p>
             <p className="text-sm text-muted-foreground text-center">{t("clientPortal.unlinkedDescription")}</p>
             <button onClick={handleLogout} className="text-primary text-sm hover:underline">{t("clientPortal.logout")}</button>
          </div>
        )}
      </main>
      {!session && <Footer />}
    </>
  );
};

export default AreaDoClientePage;
