import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BudgetHero from "@/components/orcamento/BudgetHero";
import DiagnosticForm, { type DiagnosticData } from "@/components/orcamento/DiagnosticForm";
import PlanSelector, { plans } from "@/components/orcamento/PlanSelector";
import InvestmentCalculator, { type Addons } from "@/components/orcamento/InvestmentCalculator";
import IncludedServices from "@/components/orcamento/IncludedServices";
import BudgetAuthority from "@/components/orcamento/BudgetAuthority";
import BudgetLeadForm, { type LeadFormData } from "@/components/orcamento/BudgetLeadForm";
import ContractSection from "@/components/orcamento/ContractSection";
import PaymentPreparation from "@/components/orcamento/PaymentPreparation";

const OrcamentoTiPage = () => {
  // Diagnostic
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const [diagnosticComplete, setDiagnosticComplete] = useState(false);

  // Plan & Calculator
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
  const monthlyValue = plan.price * computersQty;

  const handleDiagnosticComplete = useCallback((data: DiagnosticData) => {
    setDiagnosticData(data);
    setDiagnosticComplete(true);
    setComputersQty(data.computersCurrent || 5);
  }, []);

  const handleLeadSubmit = useCallback(
    async (formData: LeadFormData) => {
      // 1. Create lead
      const { data: leadRow, error: leadErr } = await supabase
        .from("budget_leads" as any)
        .insert({
          company_name: formData.companyName,
          contact_name: formData.contactName,
          email: formData.email,
          phone: formData.phone || null,
          city: formData.city || null,
          observations: formData.observations || null,
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
          selected_plan: selectedPlan,
          computers_qty: computersQty,
          users_qty: usersQty,
          needs_server_migration: addons.serverMigration,
          needs_remote_access: addons.remoteAccess,
          needs_backup: addons.backup,
          monthly_value: monthlyValue,
          status: "pending",
        } as any)
        .select()
        .single();

      if (quoteErr) throw quoteErr;
      const quote = quoteRow as any;
      setQuoteId(quote.id);
      setCompanyName(formData.companyName);

      // 3. Store diagnostic if completed
      if (diagnosticData) {
        await supabase.from("network_diagnostics" as any).insert({
          quote_id: quote.id,
          computers_current: diagnosticData.computersCurrent,
          average_pc_age: diagnosticData.averagePcAge,
          maintenance_frequency: diagnosticData.maintenanceFrequency,
          has_server: diagnosticData.hasServer,
          has_backup: diagnosticData.hasBackup,
        } as any);
      }

      // 4. Create contract placeholder
      await supabase.from("contracts" as any).insert({
        quote_id: quote.id,
        contract_text: null,
        signed: false,
      } as any);

      setLeadSubmitted(true);
    },
    [selectedPlan, computersQty, usersQty, addons, monthlyValue, diagnosticData]
  );

  const handleContractSign = useCallback(async () => {
    if (!quoteId) return;

    // Get client IP
    let clientIp = "unknown";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      clientIp = data.ip;
    } catch {
      // fallback
    }

    // Generate contract text
    const contractText = `Contrato assinado digitalmente — Plano ${plan.name}, ${computersQty} computadores, R$${monthlyValue}/mês`;

    await supabase
      .from("contracts" as any)
      .update({
        contract_text: contractText,
        signed: true,
        signed_at: new Date().toISOString(),
        client_ip: clientIp,
      } as any)
      .eq("quote_id", quoteId);

    // Create payment placeholder
    await supabase.from("payments" as any).insert({
      quote_id: quoteId,
      asaas_payment_id: null,
      payment_method: null,
      payment_status: "pending",
    } as any);

    setContractSigned(true);
  }, [quoteId, plan.name, computersQty, monthlyValue]);

  return (
    <>
      <Helmet>
        <title>Orçamento de Infraestrutura de TI | WMTi</title>
        <meta
          name="description"
          content="Calcule o investimento em infraestrutura de TI para sua empresa. Locação de computadores Dell a partir de R$249/mês com suporte completo."
        />
      </Helmet>

      <Navbar />

      <main>
        <BudgetHero />
        <DiagnosticForm onComplete={handleDiagnosticComplete} completed={diagnosticComplete} />
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
        <BudgetAuthority />
        <BudgetLeadForm onSubmit={handleLeadSubmit} submitted={leadSubmitted} />
        <ContractSection
          visible={leadSubmitted}
          selectedPlan={selectedPlan}
          computersQty={computersQty}
          monthlyValue={monthlyValue}
          companyName={companyName}
          onSign={handleContractSign}
          signed={contractSigned}
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
