import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import ClientLogin from "@/components/area-cliente/ClientLogin";
import ClientPortal from "@/components/area-cliente/ClientPortal";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { logSistema } from "@/lib/logSistema";
import { useTranslation } from "react-i18next";
import { resolvePortalCustomer } from "@/lib/customerResolver";

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
  status_cliente?: string | null;
}

const AreaDoClientePage = () => {
  const { t } = useTranslation();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const loadingRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadingRef.current = true;
    window.scrollTo(0, 0);

    const syncPortalState = async (sess: any, shouldLog = false) => {
      if (!mountedRef.current) return;

      if (!sess?.user) {
        setCustomer(null);
        loadingRef.current = false;
        setLoading(false);
        return;
      }

      try {
        const resolvedCustomer = await resolvePortalCustomer(sess.user.id, sess.user.email ?? null);
        if (!mountedRef.current) return;

        setCustomer(resolvedCustomer ? (resolvedCustomer as CustomerData) : null);

        if (resolvedCustomer && shouldLog) {
          void logSistema({
            tipo: "admin",
            status: "info",
            mensagem: "Acesso à Área do Cliente",
            payload: { user_id: sess.user.id, customer_id: resolvedCustomer.id },
          });
        }
      } catch (error) {
        console.error("[AreaDoClientePage] Erro ao carregar cliente:", error);
        if (!mountedRef.current) return;
        setCustomer(null);
      } finally {
        if (mountedRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    };

    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn("[AreaDoClientePage] Safety timeout: forcing loading=false after 6s");
        loadingRef.current = false;
        setLoading(false);
      }
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!initializedRef.current || !mountedRef.current) return;
      setSession(sess);
      void syncPortalState(sess, event === "SIGNED_IN");
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!mountedRef.current) return;
      setSession(sess);
      initializedRef.current = true;
      void syncPortalState(sess);
    }).catch((error) => {
      console.error("[AreaDoClientePage] Erro ao restaurar sessão:", error);
      if (!mountedRef.current) return;
      initializedRef.current = true;
      loadingRef.current = false;
      setSession(null);
      setCustomer(null);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
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
          customer.status_cliente === "suspenso" || customer.status_cliente === "excluido_lgpd" ? (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
              <p className="text-destructive text-center font-bold">
                {customer.status_cliente === "excluido_lgpd"
                  ? "Conta Removida"
                  : t("clientPortal.suspendedTitle", "Acesso Suspenso")}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {customer.status_cliente === "excluido_lgpd"
                  ? "Sua conta foi removida conforme solicitação LGPD. Entre em contato caso precise de suporte."
                  : t("clientPortal.suspendedDescription", "Seu acesso foi suspenso. Entre em contato com o suporte para mais informações.")}
              </p>
              <button onClick={handleLogout} className="text-primary text-sm hover:underline">{t("clientPortal.logout")}</button>
            </div>
          ) : (
            <ClientPortal customer={customer} onLogout={handleLogout} />
          )
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
