import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SeoHead from "@/components/SeoHead";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BudgetHero from "@/components/orcamento/BudgetHero";
import PathSelector, { type CommercialPath } from "@/components/orcamento/PathSelector";
import QualificationForm, { type QualificationData } from "@/components/orcamento/QualificationForm";
import PlanSelector, { plans } from "@/components/orcamento/PlanSelector";
import InvestmentCalculator, { type Addons } from "@/components/orcamento/InvestmentCalculator";
import SupportCalculator, { calculateSupportTotal } from "@/components/orcamento/SupportCalculator";
import Recommendation, { getRecommendation } from "@/components/orcamento/Recommendation";
import IncludedServices from "@/components/orcamento/IncludedServices";
import BudgetAuthority from "@/components/orcamento/BudgetAuthority";
import BudgetLeadForm, { type LeadFormData } from "@/components/orcamento/BudgetLeadForm";
import ContractSection from "@/components/orcamento/ContractSection";
import PaymentPreparation from "@/components/orcamento/PaymentPreparation";

const OrcamentoTiPage = () => {
  const [searchParams] = useSearchParams();

  // Path selection
  const [selectedPath, setSelectedPath] = useState<CommercialPath | null>(null);

  // Qualification
  const [qualification, setQualification] = useState<QualificationData | null>(null);
  const [qualificationComplete, setQualificationComplete] = useState(false);

  // Rental plan & calculator
  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [computersQty, setComputersQty] = useState(5);
  const [usersQty, setUsersQty] = useState(5);
  const [addons, setAddons] = useState<Addons>({
    serverMigration: false,
    remoteAccess: false,
    backup: false,
  });

  // Lead & submission
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [quoteId, setQuoteId] = useState<string | null>(null);

  // Contract
  const [contractSigned, setContractSigned] = useState(false);

  const plan = plans.find((p) => p.id === selectedPlan) || plans[1];
  const rentalMonthly = plan.price * computersQty;

  const supportMonthly = useMemo(() => {
    if (!qualification) return 0;
    return calculateSupportTotal(qualification).total;
  }, [qualification]);

  // Determine the effective path after qualification
  const effectivePath = useMemo(() => {
    if (selectedPath === "locacao") return "locacao";
    if (selectedPath === "suporte") return "suporte";
    if (selectedPath === "ajuda" && qualification) {
      return getRecommendation(qualification);
    }
    return null;
  }, [selectedPath, qualification]);

  const monthlyValue = effectivePath === "suporte" ? supportMonthly : rentalMonthly;

  const scrollToSection = useCallback((id: string) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  // Context from query params
  const contextTitle = useMemo(() => {
    const problema = searchParams.get("problema");
    const servico = searchParams.get("servico");
    const cidade = searchParams.get("cidade");

    if (problema === "backup") return "Descubra como resolver o backup da sua empresa";
    if (problema === "rede") return "Resolva os problemas de rede da sua empresa";
    if (problema === "servidor") return "Resolva os problemas do servidor da sua empresa";
    if (servico === "locacao-de-computadores") return "Calcule a locação de computadores para sua empresa";
    if (cidade) return `Orçamento de TI para sua empresa em ${cidade.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`;
    return null;
  }, [searchParams]);

  const handlePathSelect = useCallback((path: CommercialPath) => {
    setSelectedPath(path);
    scrollToSection("qualification");
  }, [scrollToSection]);

  const handleQualificationComplete = useCallback((data: QualificationData) => {
    setQualification(data);
    setQualificationComplete(true);
    setComputersQty(data.computersQty || 5);
    setUsersQty(data.computersQty || 5);
    setAddons({
      serverMigration: false,
      remoteAccess: data.needsRemoteAccess,
      backup: data.needsBackup,
    });

    const rec = selectedPath === "ajuda" ? getRecommendation(data) : selectedPath;
    if (rec === "locacao") {
      scrollToSection("plans");
    } else {
      scrollToSection("support-calculator");
    }
  }, [selectedPath, scrollToSection]);

  const handleLeadSubmit = useCallback(
    async (formData: LeadFormData) => {
      const pathLabel = effectivePath === "locacao" ? "Locação" : "Suporte";

      // Build observations with summary
      const summaryLines = [
        `Caminho: ${pathLabel}`,
        `Computadores: ${qualification?.computersQty ?? computersQty}`,
        `Idade média: ${qualification?.averageAge ?? "N/A"}`,
        `Core i3+: ${qualification?.isMinCoreI3 ? "Sim" : "Não"}`,
        `Servidores: ${qualification?.serversQty ?? 0}`,
        effectivePath === "locacao" ? `Plano: ${plan.name}` : null,
        `Valor estimado: R$${monthlyValue.toLocaleString("pt-BR")}/mês`,
        `Backup: ${qualification?.needsBackup ? "Sim" : "Não"}`,
        `Acesso remoto: ${qualification?.needsRemoteAccess ? "Sim" : "Não"}`,
        `AD/GPO: ${qualification?.needsActiveDirectory ? "Sim" : "Não"}`,
        formData.observations ? `Obs: ${formData.observations}` : null,
      ].filter(Boolean).join("\n");

      // 1. Create lead
      const { data: leadRow, error: leadErr } = await supabase
        .from("budget_leads" as any)
        .insert({
          company_name: formData.companyName,
          contact_name: formData.contactName,
          email: formData.email,
          phone: formData.phone || null,
          city: formData.city || null,
          observations: summaryLines,
        } as any)
        .select()
        .single();

      if (leadErr) throw leadErr;
      const lead = leadRow as any;

      // 2. Create quote
      const { data: quoteRow, error: quoteErr } = await supabase
        .from("quotes" as any)
        .insert({
          lead_id: lead.id,
          selected_plan: effectivePath === "locacao" ? selectedPlan : "suporte-mensal",
          computers_qty: qualification?.computersQty ?? computersQty,
          users_qty: usersQty,
          needs_server_migration: addons.serverMigration,
          needs_remote_access: addons.remoteAccess || qualification?.needsRemoteAccess || false,
          needs_backup: addons.backup || qualification?.needsBackup || false,
          monthly_value: monthlyValue,
          status: "pending",
        } as any)
        .select()
        .single();

      if (quoteErr) throw quoteErr;
      const quote = quoteRow as any;
      setQuoteId(quote.id);
      setCompanyName(formData.companyName);

      // 3. Store diagnostic
      if (qualification) {
        await supabase.from("network_diagnostics" as any).insert({
          quote_id: quote.id,
          computers_current: qualification.computersQty,
          average_pc_age: qualification.averageAge,
          maintenance_frequency: qualification.frequentMaintenance ? "frequente" : "raramente",
          has_server: qualification.serversQty > 0,
          has_backup: qualification.needsBackup,
        } as any);
      }

      // 4. Create contract placeholder
      await supabase.from("contracts" as any).insert({
        quote_id: quote.id,
        contract_text: null,
        signed: false,
      } as any);

      setLeadSubmitted(true);
      scrollToSection("contract-section");
    },
    [effectivePath, selectedPlan, computersQty, usersQty, addons, monthlyValue, qualification, plan.name, scrollToSection]
  );

  const handleContractSign = useCallback(async () => {
    if (!quoteId) return;

    let clientIp = "unknown";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      clientIp = data.ip;
    } catch {}

    const pathLabel = effectivePath === "locacao" ? `Locação — Plano ${plan.name}` : "Suporte Mensal";
    const contractText = `Contrato assinado digitalmente — ${pathLabel}, ${computersQty} computadores, R$${monthlyValue}/mês`;

    await supabase
      .from("contracts" as any)
      .update({
        contract_text: contractText,
        signed: true,
        signed_at: new Date().toISOString(),
        client_ip: clientIp,
      } as any)
      .eq("quote_id", quoteId);

    await supabase.from("payments" as any).insert({
      quote_id: quoteId,
      asaas_payment_id: null,
      payment_method: null,
      payment_status: "pending",
    } as any);

    setContractSigned(true);
    scrollToSection("payment-section");
  }, [quoteId, effectivePath, plan.name, computersQty, monthlyValue, scrollToSection]);

  const showRentalFlow = effectivePath === "locacao";
  const showSupportFlow = effectivePath === "suporte";

  return (
    <>
      <SeoHead
        title="Orçamento de Infraestrutura de TI | WMTi"
        description="Calcule o investimento em infraestrutura de TI para sua empresa. Locação de computadores Dell a partir de R$249/mês ou suporte mensal a partir de R$120/mês."
      />

      <Navbar />

      <main>
        <BudgetHero contextTitle={contextTitle} />
        <PathSelector onSelect={handlePathSelect} selected={selectedPath} />

        {selectedPath && (
          <QualificationForm
            onComplete={handleQualificationComplete}
            completed={qualificationComplete}
            data={qualification}
          />
        )}

        {/* RENTAL PATH */}
        {qualificationComplete && showRentalFlow && (
          <>
            <PlanSelector selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} />
            <InvestmentCalculator
              selectedPlan={selectedPlan}
              computersQty={computersQty}
              setComputersQty={setComputersQty}
              usersQty={usersQty}
              setUsersQty={setUsersQty}
              addons={addons}
              setAddons={setAddons}
            />
            <IncludedServices />
          </>
        )}

        {/* SUPPORT PATH */}
        {qualificationComplete && showSupportFlow && qualification && (
          <SupportCalculator qualification={qualification} />
        )}

        {/* RECOMMENDATION (always show after qualification) */}
        {qualificationComplete && qualification && (
          <Recommendation
            qualification={qualification}
            chosenPath={selectedPath!}
            rentalMonthly={rentalMonthly}
            supportMonthly={supportMonthly}
          />
        )}

        {qualificationComplete && <BudgetAuthority />}

        {qualificationComplete && (
          <BudgetLeadForm
            onSubmit={handleLeadSubmit}
            submitted={leadSubmitted}
            onContinueToContract={() => scrollToSection("contract-section")}
          />
        )}

        <ContractSection
          visible={leadSubmitted}
          selectedPlan={effectivePath === "locacao" ? selectedPlan : "suporte-mensal"}
          computersQty={qualification?.computersQty ?? computersQty}
          monthlyValue={monthlyValue}
          companyName={companyName}
          onSign={handleContractSign}
          signed={contractSigned}
          pathLabel={effectivePath === "locacao" ? "Locação" : "Suporte Mensal"}
        />
        <PaymentPreparation
          visible={contractSigned}
          monthlyValue={monthlyValue}
          companyName={companyName}
        />
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default OrcamentoTiPage;
