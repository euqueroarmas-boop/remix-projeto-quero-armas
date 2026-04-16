import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Package, MessageSquare, DollarSign,
  FileText, FolderOpen, Building2, LogOut, Menu, X, Lock, Headphones
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientContracts, useClientPayments } from "./hooks/useClientData";
import { useServiceStatus } from "./hooks/useServiceStatus";
import PortalOverview from "./sections/PortalOverview";
import PortalServicos from "./sections/PortalServicos";
import PortalSolicitacoes from "./sections/PortalSolicitacoes";
import PortalFinanceiro from "./sections/PortalFinanceiro";
import PortalFiscal from "./sections/PortalFiscal";
import PortalDocumentos from "./sections/PortalDocumentos";
import PortalPerfil from "./sections/PortalPerfil";
import PortalSuporte from "./sections/PortalSuporte";
import PortalPecas from "./sections/PortalPecas";
import PaymentPendingBanner from "./shared/PaymentPendingBanner";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "servicos", label: "Meus Serviços", icon: Package },
  { id: "solicitacoes", label: "Solicitações", icon: MessageSquare },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "fiscal", label: "Fiscal", icon: FileText },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
  { id: "pecas", label: "Peças", icon: FileText },
  { id: "suporte", label: "Suporte", icon: Headphones },
  { id: "perfil", label: "Perfil", icon: Building2 },
] as const;

type TabId = typeof tabs[number]["id"];

interface Props {
  customer: CustomerData;
  onLogout: () => void;
}

export default function ClientPortal({ customer, onLogout }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { contracts } = useClientContracts(customer.id);
  const { payments } = useClientPayments(customer.id);
  const { accessLevel, bestStatus, isTabAllowed, restrictedMessage } = useServiceStatus(contracts);

  // Eligibility: client has posse or porte contract/service
  const isPecasEligible = contracts.some((c: any) => {
    const type = (c.contract_type || "").toLowerCase();
    return type.includes("posse") || type.includes("porte");
  });

  const latestInvoiceUrl = payments.find((p: any) => p.asaas_invoice_url)?.asaas_invoice_url || null;

  const handleTabClick = (tabId: TabId) => {
    if (!isTabAllowed(tabId)) {
      toast.error("Acesso restrito. Aguarde a confirmação do pagamento.");
      return;
    }
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const handleRequestReview = useCallback(async () => {
    try {
      // Find the latest contract for this customer
      const latestContract = contracts[0];
      if (latestContract) {
        await supabase.from("client_events").insert({
          customer_id: customer.id,
          event_type: "solicitacao",
          title: "Solicitação de revisão financeira",
          description: "Cliente informou que já realizou o pagamento e solicitou revisão.",
        });
      }
      toast.success("Solicitação enviada! Nossa equipe financeira irá verificar.");
    } catch {
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    }
  }, [contracts, customer.id]);

  const localizedTabs = tabs.map((tab) => ({ ...tab, label: t(`clientPortal.tabs.${tab.id}`) }));

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <PortalOverview customer={customer} onNavigate={(t: string) => handleTabClick(t as TabId)} accessLevel={accessLevel} />;
      case "servicos": return <PortalServicos customer={customer} />;
      case "solicitacoes": return <PortalSolicitacoes customer={customer} />;
      case "financeiro": return <PortalFinanceiro customer={customer} />;
      case "fiscal": return <PortalFiscal customer={customer} />;
      case "documentos": return <PortalDocumentos customer={customer} />;
      case "pecas": return <PortalPecas customer={customer} eligible={isPecasEligible} />;
      case "suporte": return <PortalSuporte customer={customer} />;
      case "perfil": return <PortalPerfil customer={customer} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar-background p-4 sticky top-0 h-screen">
        <div className="mb-8">
          <h2 className="font-heading text-lg font-bold text-foreground">{t("clientPortal.title")}</h2>
          <p className="text-xs text-muted-foreground truncate mt-1">{customer.nome_fantasia || customer.razao_social}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {localizedTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const allowed = isTabAllowed(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  !allowed
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {allowed ? <Icon size={18} /> : <Lock size={18} />}
                {tab.label}
                {!allowed && <span className="ml-auto text-[10px] text-muted-foreground/50">🔒</span>}
              </button>
            );
          })}
        </nav>

        <Button variant="ghost" size="sm" onClick={onLogout} className="mt-4 text-muted-foreground hover:text-destructive">
          <LogOut size={16} className="mr-2" /> {t("clientPortal.logout")}
        </Button>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground">{t("clientPortal.title")}</h2>
          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{customer.nome_fantasia || customer.razao_social}</p>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm pt-16"
          >
            <nav className="p-4 space-y-1">
              {localizedTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const allowed = isTabAllowed(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      !allowed
                        ? "text-muted-foreground/50"
                        : active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {allowed ? <Icon size={18} /> : <Lock size={18} />}
                    {tab.label}
                    {!allowed && <span className="ml-auto text-[10px]">🔒</span>}
                  </button>
                );
              })}
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10">
                <LogOut size={18} /> {t("clientPortal.logout")}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 p-4 pt-20 lg:pt-8 overflow-auto">
        {/* Payment Pending Banner */}
        {accessLevel === "restricted" && restrictedMessage && (
          <div className="mb-6">
            <PaymentPendingBanner
              status={bestStatus}
              message={restrictedMessage}
              invoiceUrl={latestInvoiceUrl}
              onRequestReview={handleRequestReview}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
