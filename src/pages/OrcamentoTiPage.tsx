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
import CustomerDataForm, { type CustomerData } from "@/components/orcamento/CustomerDataForm";
import ContractPreview, { generateContractHtml } from "@/components/orcamento/ContractPreview";
import SignatureCanvas from "@/components/orcamento/SignatureCanvas";
import PaymentSelector from "@/components/orcamento/PaymentSelector";

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
  const [quoteId, setQuoteId] = useState<string | null>(null);

  // Customer data (new)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [customerComplete, setCustomerComplete] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Contract (new)
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractSigned, setContractSigned] = useState(false);

  // Payment (new)
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === selectedPlan) || plans[1];
  const rentalMonthly = plan.price * computersQty;

  const supportMonthly = useMemo(() => {
    if (!qualification) return 0;
    return calculateSupportTotal(qualification).total;
  }, [qualification]);

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
      const summaryLines = [
        `Caminho: ${pathLabel}`,
        `Computadores: ${qualification?.computersQty ?? computersQty}`,
        `Idade média: ${qualification?.averageAge ?? "N/A"}`,
        `Core i3+: ${qualification?.isMinCoreI3 ? "Sim" : "Não"}`,
        `Servidores: ${qualification?.serversQty ?? 0}`,
        effectivePath === "locacao" ? `Plano: ${plan.name}` : null,
        `Valor estimado: R$${monthlyValue.toLocaleString("pt-BR")}/mês`,
        formData.observations ? `Obs: ${formData.observations}` : null,
      ].filter(Boolean).join("\n");

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

      setLeadSubmitted(true);
      scrollToSection("customer-data");
    },
    [effectivePath, selectedPlan, computersQty, usersQty, addons, monthlyValue, qualification, plan.name, scrollToSection]
  );

  const handleCustomerComplete = useCallback(
    async (data: CustomerData) => {
      const { data: row, error } = await supabase
        .from("customers" as any)
        .insert({
          razao_social: data.razaoSocial,
          nome_fantasia: data.nomeFantasia || null,
          cnpj_ou_cpf: data.cnpjOuCpf,
          responsavel: data.responsavel,
          email: data.email,
          telefone: data.telefone || null,
          endereco: data.endereco,
          cidade: data.cidade,
          cep: data.cep,
        } as any)
        .select()
        .single();

      if (error) throw error;
      const customer = row as any;
      setCustomerId(customer.id);
      setCustomerData(data);
      setCustomerComplete(true);

      console.log("[WMTi] Dados do cliente salvos. Gerando contrato automaticamente...");

      // Generate contract HTML
      const contractType = effectivePath === "locacao" ? "locacao" : "suporte";
      const contractHtml = generateContractHtml(
        data,
        contractType as "locacao" | "suporte",
        effectivePath === "locacao" ? plan : null,
        qualification?.computersQty ?? computersQty,
        monthlyValue
      );

      // Hash the contract
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(contractHtml));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Create contract record
      const { data: contractRow, error: contractErr } = await supabase
        .from("contracts" as any)
        .insert({
          quote_id: quoteId,
          customer_id: customer.id,
          contract_type: contractType,
          contract_text: contractHtml,
          monthly_value: monthlyValue,
          contract_hash: contractHash,
          status: "draft",
          signed: false,
        } as any)
        .select()
        .single();

      if (contractErr) throw contractErr;
      setContractId((contractRow as any).id);
      console.log("[WMTi] Contrato gerado com sucesso. ID:", (contractRow as any).id, "Hash:", contractHash);

      // Save equipment config for rental
      if (effectivePath === "locacao") {
        const cpuParts = plan.cpu.split(" ");
        const cpuGen = cpuParts.slice(1).join(" ");
        await supabase.from("contract_equipment" as any).insert({
          contract_id: (contractRow as any).id,
          computer_model: "Dell OptiPlex",
          cpu: `Core ${cpuParts[0] === "Core" ? cpuParts[1] : cpuParts[0]}`,
          cpu_generation: cpuGen || plan.cpu,
          ram: plan.ram.replace(" RAM", ""),
          ssd: plan.ssd.replace(" SSD", ""),
          network: "Placa de rede Gigabit",
          monitor_brand: "Dell",
          monitor_size: '18.5"',
          keyboard_model: "Teclado USB ABNT2",
          mouse_model: "Mouse óptico USB",
          quantity: qualification?.computersQty ?? computersQty,
          unit_price: plan.price,
          monthly_total: monthlyValue,
        } as any);
      }

      scrollToSection("contract-preview");
    },
    [quoteId, effectivePath, plan, qualification, computersQty, monthlyValue, scrollToSection]
  );

  const handleSignContract = useCallback(
    async (signatureData: string, signerName: string) => {
      if (!contractId) return;

      let clientIp = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        clientIp = data.ip;
      } catch {}

      const userAgent = navigator.userAgent;

      // Get contract hash
      let contractHash = "";
      const { data: contractRow } = await supabase
        .from("contracts" as any)
        .select("contract_hash")
        .eq("id", contractId)
        .single();
      if (contractRow) contractHash = (contractRow as any).contract_hash || "";

      // Save signature
      await supabase.from("contract_signatures" as any).insert({
        contract_id: contractId,
        signer_name: signerName,
        signature_data: signatureData,
        ip_address: clientIp,
        user_agent: userAgent,
        contract_hash: contractHash,
      } as any);

      // Update contract status
      await supabase
        .from("contracts" as any)
        .update({
          signed: true,
          signed_at: new Date().toISOString(),
          client_ip: clientIp,
          status: "AGUARDANDO PAGAMENTO",
        } as any)
        .eq("id", contractId);

      // Create payment placeholder
      await supabase.from("payments" as any).insert({
        quote_id: quoteId,
        payment_status: "pending",
      } as any);

      setContractSigned(true);
      scrollToSection("payment-selection");
    },
    [contractId, quoteId, scrollToSection]
  );

  const handlePaymentSelect = useCallback(
    async (billingType: "BOLETO" | "CREDIT_CARD"): Promise<string | null> => {
      if (!customerData || !quoteId) return null;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const contractType = effectivePath === "locacao" ? "Locação de Equipamentos" : "Serviços de TI";
      const description = `Contrato WMTi — ${contractType} — ${qualification?.computersQty ?? computersQty} computador(es)`;

      setPaymentError(null);

      try {
        console.log("[WMTi] Criando cobrança no Asaas...", { billingType, monthlyValue, dueDateStr });

        const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
          body: {
            customer_name: customerData.razaoSocial,
            customer_email: customerData.email,
            customer_cpf_cnpj: customerData.cnpjOuCpf,
            billing_type: billingType,
            value: monthlyValue,
            due_date: dueDateStr,
            description,
            quote_id: quoteId,
          },
        });

        if (error) {
          console.error("[WMTi] Erro na função de pagamento:", error);
          throw new Error(error.message || "Erro ao criar cobrança");
        }

        console.log("[WMTi] Resposta do Asaas:", data);

        const url = data?.invoice_url || null;

        if (!url) {
          console.error("[WMTi] Asaas não retornou URL de pagamento:", data);
          throw new Error("O sistema de pagamento não retornou um link de cobrança. Tente novamente.");
        }

        setInvoiceUrl(url);
        setPaymentComplete(true);
        console.log("[WMTi] Cobrança criada com sucesso. URL:", url);
        return url;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido ao gerar cobrança";
        console.error("[WMTi] Falha no pagamento:", message);
        setPaymentError(message);
        setPaymentComplete(false);
        setInvoiceUrl(null);
        return null;
      }
    },
    [customerData, quoteId, effectivePath, qualification, computersQty, monthlyValue]
  );

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

        {/* RECOMMENDATION */}
        {qualificationComplete && qualification && (
          <Recommendation
            qualification={qualification}
            chosenPath={selectedPath!}
            rentalMonthly={rentalMonthly}
            supportMonthly={supportMonthly}
          />
        )}

        {qualificationComplete && <BudgetAuthority />}

        {/* LEAD FORM */}
        {qualificationComplete && (
          <BudgetLeadForm
            onSubmit={handleLeadSubmit}
            submitted={leadSubmitted}
            onContinueToContract={() => scrollToSection("customer-data")}
          />
        )}

        {/* CUSTOMER DATA FORM (new) */}
        <CustomerDataForm
          visible={leadSubmitted}
          onComplete={handleCustomerComplete}
          completed={customerComplete}
        />

        {/* CONTRACT PREVIEW (new) */}
        <ContractPreview
          visible={customerComplete}
          customer={customerData}
          contractType={effectivePath === "locacao" ? "locacao" : "suporte"}
          plan={effectivePath === "locacao" ? plan : null}
          computersQty={qualification?.computersQty ?? computersQty}
          monthlyValue={monthlyValue}
        />

        {/* SIGNATURE (new) */}
        <SignatureCanvas
          visible={customerComplete}
          onSign={handleSignContract}
          signed={contractSigned}
        />

        {/* PAYMENT SELECTION (new) */}
        <PaymentSelector
          visible={contractSigned}
          monthlyValue={monthlyValue}
          onSelectPayment={handlePaymentSelect}
          completed={paymentComplete}
          invoiceUrl={invoiceUrl}
          error={paymentError}
        />
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default OrcamentoTiPage;
