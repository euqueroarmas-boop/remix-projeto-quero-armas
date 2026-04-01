import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Minus, Plus, Clock, TrendingDown, ArrowRight, CheckCircle, CheckCircle2,
  FileText, CreditCard, FileBarChart, Loader2, ExternalLink,
  AlertTriangle, RotateCcw, ChevronRight, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import WizardStepWrapper from "@/components/orcamento/WizardStepWrapper";
import QuickRegistrationForm, { type RegistrationData } from "@/components/orcamento/QuickRegistrationForm";
import { generateContractHtml } from "@/components/orcamento/ContractPreview";
import ContractingWizard from "@/components/orcamento/ContractingWizard";
import { plans } from "@/components/orcamento/PlanSelector";
import ServerAdminRegistrationForm, { type ServerAdminRegistrationData } from "@/components/orcamento/ServerAdminRegistrationForm";
import ContractModeSelector, { type ContractMode } from "@/components/ContractModeSelector";
import UnifiedInfraCalculator from "@/components/orcamento/UnifiedInfraCalculator";

import type { CustomerData } from "@/components/orcamento/CustomerDataForm";

/* ─── Service catalog ─── */
interface ServiceInfo {
  name: string;
  slug: string;
  isEmergency: boolean;
}

const SERVICE_CATALOG: ServiceInfo[] = [
  { name: "Administração De Servidores", slug: "administracao-de-servidores", isEmergency: false },
  { name: "Backup Corporativo", slug: "backup-corporativo", isEmergency: false },
  { name: "Firewall Corporativo pfSense", slug: "firewall-pfsense-jacarei", isEmergency: false },
  { name: "Implantação De Servidores Dell PowerEdge", slug: "servidor-dell-poweredge-jacarei", isEmergency: false },
  { name: "Infraestrutura De TI Corporativa", slug: "infraestrutura-ti-corporativa-jacarei", isEmergency: false },
  { name: "Locação De Computadores", slug: "locacao-de-computadores-para-empresas-jacarei", isEmergency: false },
  { name: "Manutenção De Infraestrutura De TI", slug: "manutencao-de-infraestrutura-de-ti", isEmergency: false },
  { name: "Microsoft 365 Para Empresas", slug: "microsoft-365-para-empresas-jacarei", isEmergency: false },
  { name: "Monitoramento De Rede", slug: "monitoramento-de-rede", isEmergency: false },
  { name: "Monitoramento De Servidores", slug: "monitoramento-de-servidores", isEmergency: false },
  { name: "Montagem E Monitoramento De Redes", slug: "montagem-e-monitoramento-de-redes-jacarei", isEmergency: false },
  { name: "Segurança De Rede", slug: "seguranca-de-rede", isEmergency: false },
  { name: "Suporte Linux", slug: "suporte-linux", isEmergency: false },
  { name: "Suporte Técnico Emergencial", slug: "suporte-tecnico-emergencial", isEmergency: true },
  { name: "Suporte Técnico Empresarial", slug: "suporte-ti-jacarei", isEmergency: false },
  { name: "Suporte Técnico Para Redes Corporativas", slug: "suporte-tecnico-para-redes-corporativas", isEmergency: false },
  { name: "Suporte Windows Server", slug: "suporte-windows-server", isEmergency: false },
  { name: "Terceirização De TI", slug: "terceirizacao-de-mao-de-obra-ti", isEmergency: false },
];

/* ─── Price tables ─── */
const STANDARD_PRICES: Record<number, number> = { 1: 200, 2: 190, 3: 180, 4: 170, 5: 160, 6: 155, 7: 150, 8: 145 };
const EMERGENCY_PRICES: Record<number, number> = { 1: 300, 2: 285, 3: 270, 4: 255, 5: 240, 6: 232.5, 7: 225, 8: 217.5 };
const SERVER_ADMIN_PRICES: Record<number, number> = { 1: 500, 2: 475, 3: 450, 4: 425, 5: 400, 6: 387.5, 7: 375, 8: 362.5 };

type BillingType = "BOLETO" | "CREDIT_CARD";
type FlowStep = "calculator" | "registration" | "contract" | "payment" | "success";

const isPaidStatus = (status?: string | null) => {
  const normalized = String(status || "").toUpperCase();
  return normalized === "CONFIRMED" || normalized === "RECEIVED" || normalized === "PAYMENT_CONFIRMED" || normalized === "PAYMENT_RECEIVED";
};

const ContratarServicoPage = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const wizardRef = useRef<HTMLDivElement>(null);

  // Find service
  const service = SERVICE_CATALOG.find(s => s.slug === slug);
  const serviceName = service?.name || searchParams.get("servico") || "Serviço de TI";
  const isEmergency = service?.isEmergency || false;
  const isRentalContract = slug === "locacao-de-computadores-para-empresas-jacarei";
  const isServerAdmin = slug === "administracao-de-servidores";
  const isSupportTi = slug === "suporte-ti-jacarei";
  const selectedRentalPlanId = searchParams.get("plano") || "equilibrio";
  const selectedRentalQty = Math.max(1, Number(searchParams.get("qty") || 1));
  const selectedRentalPlan = plans.find((item) => item.id === selectedRentalPlanId) || plans[1];
  const rentalMonthlyValue = selectedRentalPlan.price * selectedRentalQty;
  const basePrice = isServerAdmin ? 500 : isEmergency ? 300 : 200;
  const priceTable = isServerAdmin ? SERVER_ADMIN_PRICES : isEmergency ? EMERGENCY_PRICES : STANDARD_PRICES;

  // Server admin params
  const serverHosts = Math.max(1, Number(searchParams.get("hosts") || 1));
  const serverVms = Math.max(0, Number(searchParams.get("vms") || 0));
  const SERVER_HOST_PRICE = 350;
  const SERVER_VM_PRICE = 200;
  const serverMonthlyValue = serverHosts * SERVER_HOST_PRICE + serverVms * SERVER_VM_PRICE;

  // Flow state
  const [currentStep, setCurrentStep] = useState<FlowStep>("calculator");
  const [hours, setHours] = useState(1);
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractSigned, setContractSigned] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<BillingType | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [contractMode, setContractMode] = useState<ContractMode | null>(
    (searchParams.get("modo") as ContractMode) || null
  );

  // Calculations
  const unitPrice = priceTable[Math.min(hours, 8)] ?? (isEmergency ? 217.5 : 145);
  const fullPrice = hours * basePrice;
  const promoPrice = hours * unitPrice;
  const savings = fullPrice - promoPrice;
  const discountPct = hours > 1 ? Math.round(((basePrice - unitPrice) / basePrice) * 100) : 0;

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  // Poll contract signed
  useEffect(() => {
    if (currentStep !== "contract" || !contractId || contractSigned) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("contracts" as any)
        .select("signed")
        .eq("id", contractId)
        .single();
      if ((data as any)?.signed) {
        setContractSigned(true);
        setCurrentStep("payment");
        scrollToTop();
        toast({ title: "Contrato assinado!", description: "Prossiga com o pagamento." });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentStep, contractId, contractSigned, toast]);

  // Poll for payment confirmation + send email
  useEffect(() => {
    if (!paymentComplete || paymentConfirmed || !quoteId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("payment_status")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data && isPaidStatus((data as any).payment_status)) {
        setPaymentConfirmed(true);
        // Email is now sent from webhook after user creation (includes credentials)
        // Save data to session and redirect to standalone page
        const purchaseData = {
          serviceName,
          hours,
          monthlyValue: promoPrice,
          isRecurring: false,
          customerName: registrationData?.razaoSocial || "",
          customerCpfCnpj: registrationData?.cnpjOuCpf || "",
          customerEmail: registrationData?.email || "",
          paymentMethod: selectedPayment || "CREDIT_CARD",
          contractId,
          purchaseDate: new Date().toLocaleDateString("pt-BR"),
        };
        try { sessionStorage.setItem("wmti_purchase_data", JSON.stringify(purchaseData)); } catch {}
        navigate(`/compra-concluida?quote=${quoteId}`);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [paymentComplete, paymentConfirmed, quoteId, registrationData, selectedPayment, contractId, serviceName, hours, promoPrice]);

  const scrollToTop = () => {
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleContinueToRegistration = () => {
    setCurrentStep("registration");
    scrollToTop();
  };

  const handleRegistrationComplete = async (data: RegistrationData) => {
    setRegistrationLoading(true);
    try {
      const fullAddress = [data.endereco, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");

      // Create budget_lead
      const { data: leadRow, error: leadErr } = await supabase
        .from("budget_leads" as any)
        .insert({
          company_name: data.razaoSocial,
          contact_name: data.responsavel,
          email: data.email,
          phone: data.telefone || null,
          city: data.cidade || null,
          observations: `Contratação avulsa: ${serviceName} - ${hours}h - R$ ${promoPrice.toFixed(2)}`,
        } as any)
        .select()
        .single();

      if (leadErr) throw leadErr;

      // Create quote
      const { data: quoteRow, error: quoteErr } = await supabase
        .from("quotes" as any)
        .insert({
          lead_id: (leadRow as any).id,
          selected_plan: `horas-${isEmergency ? "emergencial" : "avulso"}`,
          monthly_value: promoPrice,
          computers_qty: hours,
          status: "pending",
        } as any)
        .select()
        .single();

      if (quoteErr) throw quoteErr;
      setQuoteId((quoteRow as any).id);

      // Create customer
      const { data: customerRow, error: custErr } = await supabase
        .from("customers" as any)
        .insert({
          razao_social: data.razaoSocial,
          nome_fantasia: data.nomeFantasia || null,
          cnpj_ou_cpf: data.cnpjOuCpf,
          responsavel: data.responsavel,
          email: data.email,
          telefone: data.telefone || null,
          endereco: fullAddress,
          cidade: `${data.cidade}/${data.uf}`,
          cep: data.cep,
        } as any)
        .select()
        .single();

      if (custErr) throw custErr;
      setCustomerId((customerRow as any).id);
      setRegistrationData(data);

      // Generate contract
      const customerDataForContract: CustomerData = {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpjOuCpf: data.cnpjOuCpf,
        responsavel: data.responsavel,
        email: data.email,
        telefone: data.telefone,
        endereco: fullAddress,
        cidade: `${data.cidade}/${data.uf}`,
        cep: data.cep,
      };

      const html = generateHoursContractHtml(customerDataForContract, serviceName, isEmergency, hours, unitPrice, promoPrice, savings);

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(html));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: contractRow, error: contractErr } = await supabase
        .from("contracts" as any)
        .insert({
          quote_id: (quoteRow as any).id,
          customer_id: (customerRow as any).id,
          contract_type: "horas-tecnicas",
          contract_text: html,
          monthly_value: promoPrice,
          contract_hash: contractHash,
          status: "draft",
          signed: false,
          accepted_minimum_term: false,
        } as any)
        .select()
        .single();

      if (contractErr) throw contractErr;
      setContractId((contractRow as any).id);

      await supabase.from("payments" as any).insert({
        quote_id: (quoteRow as any).id,
        payment_status: "pending",
      } as any);

      setCurrentStep("contract");
      scrollToTop();
    } catch (err) {
      console.error("[WMTi] Erro no cadastro:", err);
      toast({ title: "Erro ao salvar dados", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleOpenContract = () => {
    if (!contractId) return;
    window.open(`/contrato?id=${contractId}`, "_blank");
  };

  const handlePayment = async () => {
    if (!selectedPayment || !registrationData || !quoteId) return;
    setPaymentLoading(true);
    setPaymentError(null);

    const description = `Pacote de ${hours} hora${hours > 1 ? "s" : ""} - ${serviceName}`;

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          customer_name: registrationData.razaoSocial,
          customer_email: registrationData.email,
          customer_cpf_cnpj: registrationData.cnpjOuCpf,
          billing_type: selectedPayment,
          value: promoPrice,
          description,
          quote_id: quoteId,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar cobrança");

      const url = data?.invoiceUrl || data?.invoice_url || data?.bankSlipUrl || data?.payment?.invoiceUrl;
      if (!url) throw new Error("O sistema de pagamento não retornou um link de cobrança.");

      setInvoiceUrl(url);
      setPaymentComplete(true);
      setPopupBlocked(false);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win || win.closed || typeof win.closed === "undefined") {
        setPopupBlocked(true);
        console.warn("[WMTi] Popup bloqueado pelo navegador");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[WMTi][payment]", message);
      setPaymentError(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const getStepStatus = (step: FlowStep) => {
    const order: FlowStep[] = ["calculator", "registration", "contract", "payment"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(step);
    if (currentStep === "success") return "completed" as const;
    if (stepIdx < currentIdx) return "completed" as const;
    if (stepIdx === currentIdx) return "active" as const;
    return "pending" as const;
  };

  if (isRentalContract) {
    // Read lead data from URL params (passed from LocacaoComputadoresPage)
    const leadCompany = searchParams.get("empresa") || "";
    const leadNomeFantasia = searchParams.get("nomeFantasia") || "";
    const leadResponsavel = searchParams.get("responsavel") || "";
    const leadEmail = searchParams.get("email") || "";
    const leadWhatsapp = searchParams.get("whatsapp") || "";
    const leadCnpj = searchParams.get("cnpj") || "";
    const leadCidade = searchParams.get("cidade") || "";
    const leadUf = searchParams.get("uf") || "";
    const leadCep = searchParams.get("cep") || "";
    const leadEndereco = searchParams.get("endereco") || "";
    const leadNumero = searchParams.get("numero") || "";
    const leadComplemento = searchParams.get("complemento") || "";
    const leadBairro = searchParams.get("bairro") || "";

    return (
      <div className="min-h-screen">
        <SeoHead
          title={`Contratar ${serviceName} | WMTi`}
          description={`Finalize a contratação da locação de computadores da WMTi com plano ${selectedRentalPlan.name} e ${selectedRentalQty} equipamento(s).`}
        />
        <Navbar />

        <section className="section-dark pt-24 md:pt-28 pb-8 border-b-4 border-primary">
          <div className="container">
             <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-1 font-mono text-xs text-muted-foreground/50">
                <li><Link to="/" className="hover:text-primary transition-colors">{t("contratar.breadcrumbHome")}</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li><Link to="/locacao-de-computadores-para-empresas-jacarei" className="hover:text-primary transition-colors">{t("services.locacao")}</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li className="text-primary" aria-current="page">{t("contratar.breadcrumbContratar")}</li>
              </ol>
            </nav>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t("contratar.tag")}</p>
            <h1 className="text-2xl md:text-4xl lg:text-5xl mb-4">
              {t("contratar.titlePrefix")} <span className="text-primary">{t("services.locacao")}</span>
            </h1>
            <p className="font-body text-lg text-muted-foreground/70 max-w-2xl leading-relaxed">
              {t("contratar.locacaoDesc")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                <span className="text-muted-foreground">{t("contratar.planoLabel")}</span> <strong className="text-primary">{selectedRentalPlan.name}</strong>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                <span className="text-muted-foreground">{t("contratar.qtdLabel")}</span> <strong>{selectedRentalQty} {t("contratar.computadores")}</strong>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                <span className="text-muted-foreground">{t("contratar.valorMensalLabel")}</span> <strong className="text-primary">R$ {rentalMonthlyValue.toLocaleString("pt-BR")}</strong>
              </div>
            </div>
          </div>
        </section>

        <ContractingWizard
          visible={true}
          effectivePath="locacao"
          plan={selectedRentalPlan}
          qualification={null}
          computersQty={selectedRentalQty}
          monthlyValue={rentalMonthlyValue}
          quoteId={null}
          leadCompanyName={leadCompany}
          leadContactName={leadResponsavel}
          leadEmail={leadEmail}
          leadPhone={leadWhatsapp}
          leadCity={leadCidade}
          leadCnpj={leadCnpj}
          leadNomeFantasia={leadNomeFantasia}
          leadUf={leadUf}
          leadCep={leadCep}
          leadEndereco={leadEndereco}
          leadNumero={leadNumero}
          leadComplemento={leadComplemento}
          leadBairro={leadBairro}
        />

        <Footer />
      </div>
    );
  }

  /* ─── Suporte Técnico Empresarial: Dual-mode (on-demand + recurring) ─── */
  if (isSupportTi) {
    const handleModeSelect = (mode: ContractMode) => {
      setContractMode(mode);
      if (mode === "sob_demanda") {
        console.log("[WMTi] CONTRACT_MODE_SELECTED_ON_DEMAND", { slug, serviceName });
      } else {
        console.log("[WMTi] CONTRACT_MODE_SELECTED_RECURRING", { slug, serviceName });
      }
    };

    // Read recurring params from URL (when coming back from UnifiedInfraCalculator redirect)
    const recurringHosts = Math.max(1, Number(searchParams.get("hosts") || 1));
    const recurringVms = Math.max(0, Number(searchParams.get("vms") || 0));
    const recurringEstacoes = Math.max(0, Number(searchParams.get("estacoes") || 0));
    const recurringTotalMensal = Number(searchParams.get("total_mensal") || 0);
    const hasRecurringParams = recurringTotalMensal > 0;

    return (
      <div className="min-h-screen">
        <SeoHead
          title={`Contratar ${serviceName} | WMTi`}
          description={`Contrate ${serviceName} com a WMTi. Escolha entre atendimento avulso por hora ou plano recorrente mensal.`}
        />
        <Navbar />

        <section className="section-dark pt-24 md:pt-28 pb-8 border-b-4 border-primary">
          <div className="container">
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-1 font-mono text-xs text-muted-foreground/50">
                <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li><Link to="/suporte-ti-jacarei" className="hover:text-primary transition-colors">Suporte Técnico Empresarial</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li className="text-primary" aria-current="page">Contratar</li>
              </ol>
            </nav>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">Contratação de serviço</p>
            <h1 className="text-2xl md:text-4xl lg:text-5xl mb-4">
              Contratar <span className="text-primary">Suporte Técnico Empresarial</span>
            </h1>
            <p className="font-body text-lg text-muted-foreground/70 max-w-2xl leading-relaxed">
              Escolha o modelo ideal para sua empresa: atendimento avulso por hora ou plano recorrente com gestão contínua.
            </p>
          </div>
        </section>

        {/* ── Mode selector ── */}
        <ContractModeSelector mode={contractMode} onSelect={handleModeSelect} />

        {/* ── ON-DEMAND: Hours calculator + wizard inline ── */}
        {contractMode === "sob_demanda" && (
          <div ref={wizardRef} className="section-dark py-12 md:py-16">
            <div className="container max-w-3xl">
              {(() => { console.log("[WMTi] HOURS_CALCULATOR_RENDERED"); return null; })()}

              {/* Step 1: Hours Calculator */}
              <WizardStepWrapper stepNumber={1} title="Calculadora de Horas" subtitle="Escolha a quantidade de horas técnicas" status={getStepStatus("calculator")}>
                <div className="space-y-6">
                  <div className="bg-secondary p-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">Serviço selecionado</p>
                      <p className="font-bold text-foreground">{serviceName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-muted-foreground">Avulso</p>
                      <p className="font-bold text-primary">R$ {basePrice.toFixed(2).replace(".", ",")}/h</p>
                    </div>
                  </div>

                  <div className="bg-secondary p-8">
                    <div className="flex items-center justify-center gap-6 mb-6">
                      <button onClick={() => setHours(Math.max(1, hours - 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Diminuir horas">
                        <Minus size={20} />
                      </button>
                      <div className="text-center">
                        <span className="text-5xl font-bold text-primary">{hours}</span>
                        <p className="font-mono text-xs text-muted-foreground mt-1">{hours} hora{hours > 1 ? "s" : ""} técnica{hours > 1 ? "s" : ""}</p>
                      </div>
                      <button onClick={() => setHours(Math.min(8, hours + 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Aumentar horas">
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between font-mono text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><Clock size={14} /> Valor por hora</span>
                        <span className="text-foreground">
                          R$ {unitPrice.toFixed(2).replace(".", ",")}
                          {discountPct > 0 && <span className="ml-2 text-xs text-primary">-{discountPct}%</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-sm">
                        <span className="text-muted-foreground">Preço cheio</span>
                        <span className="text-muted-foreground/50 line-through">R$ {fullPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="h-px bg-muted-foreground/10" />
                      <div className="flex items-center justify-between font-mono text-base font-bold">
                        <span className="text-foreground">Valor promocional</span>
                        <span className="text-primary text-xl">R$ {promoPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>

                    {savings > 0 && (
                      <div className="bg-primary/10 border border-primary/30 p-4 flex items-center gap-3">
                        <TrendingDown size={20} className="text-primary shrink-0" />
                        <p className="font-mono text-sm font-bold text-primary">
                          Economizando R$ {savings.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-3 font-bold">Resumo da contratação</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span className="text-foreground font-semibold">{serviceName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="text-foreground font-semibold">Avulso / Sob demanda</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Horas</span><span className="text-foreground font-semibold">{hours}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Valor total</span><span className="text-primary font-bold">R$ {promoPrice.toFixed(2).replace(".", ",")}</span></div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      console.log("[WMTi] CHECKOUT_STARTED_AVULSO", { hours, promoPrice, serviceName });
                      handleContinueToRegistration();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                  >
                    <ArrowRight size={16} />
                    Contratar sob demanda
                  </button>
                </div>
              </WizardStepWrapper>

              {/* Step 2: Registration */}
              <WizardStepWrapper stepNumber={2} title="Dados da empresa" subtitle="Preencha os dados para gerar o contrato" status={getStepStatus("registration")}>
                <QuickRegistrationForm onComplete={handleRegistrationComplete} loading={registrationLoading} initialData={{}} />
              </WizardStepWrapper>

              {/* Step 3: Contract */}
              <WizardStepWrapper stepNumber={3} title="Contrato e Assinatura" subtitle={contractSigned ? "Contrato assinado ✓" : "Leia e assine o contrato"} status={getStepStatus("contract")}>
                {contractSigned ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Contrato assinado!</h4>
                    <p className="text-sm text-muted-foreground">Prossiga para o pagamento abaixo.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <FileText className="w-6 h-6 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">Contrato de Horas Técnicas — {serviceName}</p>
                          <p className="text-xs text-muted-foreground">O contrato será aberto em uma página separada.</p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleOpenContract} disabled={!contractId} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir contrato para leitura e assinatura
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                      Aguardando assinatura do contrato...
                    </p>
                  </div>
                )}
              </WizardStepWrapper>

              {/* Step 4: Payment */}
              <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Compra Concluída" : "Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado ✓" : "Pagamento único via checkout seguro"} status={paymentConfirmed ? "completed" : getStepStatus("payment")} isLast>
                {paymentConfirmed ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                    <p className="text-sm text-muted-foreground">Redirecionando...</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Valor total: <strong className="text-primary">R$ {promoPrice.toFixed(2).replace(".", ",")}</strong> — Pagamento único
                    </p>
                    {paymentError && (
                      <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-destructive">Erro ao gerar cobrança</p>
                          <p className="text-xs text-muted-foreground mt-1">{paymentError}</p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { id: "BOLETO" as BillingType, icon: FileBarChart, label: "Boleto Bancário", desc: "Pagamento único" },
                        { id: "CREDIT_CARD" as BillingType, icon: CreditCard, label: "Cartão de Crédito", desc: "Pagamento único" },
                      ]).map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedPayment(method.id)}
                          className={`p-4 rounded-xl border-2 transition-all text-center ${
                            selectedPayment === method.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                          }`}
                        >
                          <method.icon className={`w-6 h-6 mx-auto mb-2 ${selectedPayment === method.id ? "text-primary" : "text-muted-foreground"}`} />
                          <p className="text-sm font-semibold text-foreground">{method.label}</p>
                          <p className="text-xs text-muted-foreground">{method.desc}</p>
                        </button>
                      ))}
                    </div>
                    <Button onClick={handlePayment} disabled={!selectedPayment || paymentLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
                      <ExternalLink className="w-5 h-5 mr-2" />
                      PROSSEGUIR PARA PAGAMENTO
                    </Button>
                  </div>
                )}
              </WizardStepWrapper>
            </div>
          </div>
        )}

        {/* ── RECURRING: Infra calculator or ContractingWizard ── */}
        {contractMode === "recorrente" && !hasRecurringParams && (
          <div>
            {(() => { console.log("[WMTi] RECURRING_INFRA_CALCULATOR_RENDERED"); return null; })()}
            <UnifiedInfraCalculator
              contractHref={`/contratar/${slug}`}
              pageTitle={serviceName}
            />
          </div>
        )}

        {contractMode === "recorrente" && hasRecurringParams && (
          <div>
            {(() => { console.log("[WMTi] CHECKOUT_STARTED_RECORRENTE", { recurringHosts, recurringVms, recurringEstacoes, recurringTotalMensal }); return null; })()}

            {/* Recurring summary badges */}
            <div className="section-dark pt-6 pb-2">
              <div className="container max-w-3xl">
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                    <span className="text-muted-foreground">Hosts: </span><strong className="text-primary">{recurringHosts}</strong>
                  </div>
                  {recurringVms > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                      <span className="text-muted-foreground">VMs: </span><strong className="text-primary">{recurringVms}</strong>
                    </div>
                  )}
                  {recurringEstacoes > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                      <span className="text-muted-foreground">Estações: </span><strong className="text-primary">{recurringEstacoes}</strong>
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                    <span className="text-muted-foreground">Mensalidade: </span><strong className="text-primary">R$ {recurringTotalMensal.toLocaleString("pt-BR")}/mês</strong>
                  </div>
                </div>
              </div>
            </div>

            <ContractingWizard
              visible={true}
              effectivePath="suporte"
              serviceSlug="suporte-ti-jacarei"
              plan={{
                id: "suporte-recorrente",
                name: "Suporte Técnico Empresarial — Recorrente",
                cpu: `${recurringHosts} Host(s)`,
                ram: `${recurringVms} VM(s)`,
                ssd: `${recurringEstacoes} Estação(ões)`,
                extras: ["Gestão contínua", "Permanência mínima 12 meses"],
                price: recurringTotalMensal,
                popular: false,
              }}
              qualification={null}
              computersQty={recurringHosts + recurringVms + recurringEstacoes}
              monthlyValue={recurringTotalMensal}
              quoteId={null}
              customRegistrationForm={(onComplete, loading) => (
                <ServerAdminRegistrationForm
                  onComplete={async (data: ServerAdminRegistrationData) => {
                    const fullAddress = [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");
                    const mapped: RegistrationData = {
                      razaoSocial: data.razaoSocial,
                      nomeFantasia: data.nomeFantasia,
                      cnpjOuCpf: data.cnpj,
                      responsavel: data.responsavelNome,
                      email: data.responsavelEmail,
                      telefone: data.responsavelTelefone,
                      cep: data.cep,
                      endereco: data.logradouro,
                      numero: data.numero,
                      complemento: data.complemento,
                      bairro: data.bairro,
                      cidade: data.cidade,
                      uf: data.uf,
                      isPJ: true,
                      representanteCpf: data.responsavelCpf,
                    };
                    await onComplete(mapped);
                  }}
                  loading={loading}
                />
              )}
            />
          </div>
        )}

        {/* Show prompt if no mode selected yet */}
        {!contractMode && (
          <div className="section-dark py-12">
            <div className="container max-w-3xl text-center">
              <p className="text-muted-foreground font-body">
                Selecione o modelo de contratação acima para prosseguir.
              </p>
            </div>
          </div>
        )}

        <Footer />
      </div>
    );
  }

  /* ─── Server Admin: Dual-mode (on-demand + recurring) ─── */
  if (isServerAdmin) {
    const handleServerModeSelect = (mode: ContractMode) => {
      setContractMode(mode);
      if (mode === "sob_demanda") {
        console.log("[WMTi] CONTRACT_MODE_SELECTED_ON_DEMAND", { slug, serviceName: "Administração de Servidores" });
      } else {
        console.log("[WMTi] CONTRACT_MODE_SELECTED_RECURRING", { slug, serviceName: "Administração de Servidores" });
      }
    };

    return (
      <div className="min-h-screen">
        <SeoHead
          title="Contratar Administração de Servidores | WMTi"
          description="Contrate administração de servidores com a WMTi. Atendimento sob demanda ou plano recorrente mensal."
        />
        <Navbar />

        <section className="section-dark pt-24 md:pt-28 pb-8 border-b-4 border-primary">
          <div className="container">
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-1 font-mono text-xs text-muted-foreground/50">
                <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li><Link to="/administracao-de-servidores" className="hover:text-primary transition-colors">Administração de Servidores</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li className="text-primary" aria-current="page">Contratar</li>
              </ol>
            </nav>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">Contratação de serviço</p>
            <h1 className="text-2xl md:text-4xl lg:text-5xl mb-4">
              Contratar <span className="text-primary">Administração de Servidores</span>
            </h1>
            <p className="font-body text-lg text-muted-foreground/70 max-w-2xl leading-relaxed">
              Escolha o modelo ideal: atendimento urgente sob demanda ou proteção contínua com plano recorrente.
            </p>
          </div>
        </section>

        {/* ── Mode selector ── */}
        <ContractModeSelector mode={contractMode} onSelect={handleServerModeSelect} />

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── FLUXO SOB DEMANDA: Calculadora de horas (urgência) ── */}
        {/* ══════════════════════════════════════════════════════════ */}
        {contractMode === "sob_demanda" && (
          <div ref={wizardRef} className="section-dark py-12 md:py-16">
            <div className="container max-w-3xl">
              {(() => { console.log("[WMTi] HOURS_CALCULATOR_RENDERED — administracao-de-servidores"); return null; })()}

              {/* Premium positioning + urgency messaging */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 space-y-4"
              >
                {/* Risk awareness */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-foreground text-sm mb-1">Servidor parado? Sistema travado?</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Cada hora com seu servidor parado pode custar mais do que este atendimento. Resolva agora antes que o prejuízo aumente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Premium positioning */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary font-bold">Por que R$ 500/h?</p>
                  <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                    <p>Você não está pagando por uma hora. Está pagando para alguém <strong className="text-foreground">experiente</strong> entrar no seu servidor e resolver o problema <strong className="text-foreground">sem piorar a situação</strong>.</p>
                    <p>Um erro em servidor pode custar <strong className="text-foreground">dias de operação</strong>. Aqui, você resolve em horas.</p>
                    <p className="text-xs text-primary font-semibold">Empresas que tentam economizar nesse momento normalmente pagam muito mais depois.</p>
                  </div>
                </div>
              </motion.div>

              {/* Step 1: Hours Calculator */}
              <WizardStepWrapper stepNumber={1} title="Calculadora de Horas" subtitle="Escolha a quantidade de horas técnicas" status={getStepStatus("calculator")}>
                <div className="space-y-6">
                  <div className="bg-secondary p-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">Serviço selecionado</p>
                      <p className="font-bold text-foreground">Administração de Servidores</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-muted-foreground">Sob demanda</p>
                      <p className="font-bold text-primary">R$ {basePrice.toFixed(2).replace(".", ",")}/h</p>
                    </div>
                  </div>

                  <div className="bg-secondary p-8">
                    <div className="flex items-center justify-center gap-6 mb-6">
                      <button onClick={() => setHours(Math.max(1, hours - 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Diminuir horas">
                        <Minus size={20} />
                      </button>
                      <div className="text-center">
                        <span className="text-5xl font-bold text-primary">{hours}</span>
                        <p className="font-mono text-xs text-muted-foreground mt-1">{hours} hora{hours > 1 ? "s" : ""} técnica{hours > 1 ? "s" : ""}</p>
                      </div>
                      <button onClick={() => setHours(Math.min(8, hours + 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Aumentar horas">
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between font-mono text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><Clock size={14} /> Valor por hora</span>
                        <span className="text-foreground">
                          R$ {unitPrice.toFixed(2).replace(".", ",")}
                          {discountPct > 0 && <span className="ml-2 text-xs text-primary">-{discountPct}%</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-sm">
                        <span className="text-muted-foreground">Preço cheio</span>
                        <span className="text-muted-foreground/50 line-through">R$ {fullPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="h-px bg-muted-foreground/10" />
                      <div className="flex items-center justify-between font-mono text-base font-bold">
                        <span className="text-foreground">Valor promocional</span>
                        <span className="text-primary text-xl">R$ {promoPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>

                    {savings > 0 && (
                      <div className="bg-primary/10 border border-primary/30 p-4 flex items-center gap-3">
                        <TrendingDown size={20} className="text-primary shrink-0" />
                        <p className="font-mono text-sm font-bold text-primary">
                          Economizando R$ {savings.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-3 font-bold">Resumo da contratação</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span className="text-foreground font-semibold">Administração de Servidores</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="text-foreground font-semibold">Sob demanda / Urgência</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Horas</span><span className="text-foreground font-semibold">{hours}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Valor total</span><span className="text-primary font-bold">R$ {promoPrice.toFixed(2).replace(".", ",")}</span></div>
                    </div>
                  </div>

                  {/* Guarantee block */}
                  <div className="relative rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-5 shadow-lg shadow-primary/5">
                    <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-primary/80 via-primary to-primary/80" />
                    <div className="flex items-center gap-2.5 mb-3">
                      <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                      <h3 className="text-sm font-bold text-foreground tracking-tight">
                        Garantia após a conclusão — segurança real no que foi feito
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">
                      Após a finalização do atendimento, você continua protegido.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      Se o mesmo problema voltar a ocorrer dentro de até 15 dias, você conta com a mesma quantidade de horas contratadas como garantia para continuidade do suporte.
                    </p>
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <p className="text-xs text-foreground/90 leading-relaxed">
                        <span className="font-bold">Contratou {hours} {hours > 1 ? "horas" : "hora"}</span> → você tem <span className="font-bold text-primary">{hours} {hours > 1 ? "horas" : "hora"} de garantia</span> para o mesmo problema, válida por até 15 dias após a conclusão.
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-primary italic">
                      Aqui o serviço é resolvido — e permanece resolvido.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      console.log("[WMTi] CHECKOUT_STARTED_AVULSO", { hours, promoPrice, serviceName: "Administração de Servidores" });
                      handleContinueToRegistration();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                  >
                    <ArrowRight size={16} />
                    Resolver agora com especialista
                  </button>
                </div>
              </WizardStepWrapper>

              {/* Step 2: Registration */}
              <WizardStepWrapper stepNumber={2} title="Dados da empresa" subtitle="Preencha os dados para gerar o contrato" status={getStepStatus("registration")}>
                <QuickRegistrationForm onComplete={handleRegistrationComplete} loading={registrationLoading} initialData={{}} />
              </WizardStepWrapper>

              {/* Step 3: Contract */}
              <WizardStepWrapper stepNumber={3} title="Contrato e Assinatura" subtitle={contractSigned ? "Contrato assinado ✓" : "Leia e assine o contrato"} status={getStepStatus("contract")}>
                {contractSigned ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Contrato assinado!</h4>
                    <p className="text-sm text-muted-foreground">Prossiga para o pagamento abaixo.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <FileText className="w-6 h-6 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">Contrato de Horas Técnicas — Administração de Servidores</p>
                          <p className="text-xs text-muted-foreground">O contrato será aberto em uma página separada.</p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleOpenContract} disabled={!contractId} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir contrato para leitura e assinatura
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                      Aguardando assinatura do contrato...
                    </p>
                  </div>
                )}
              </WizardStepWrapper>

              {/* Step 4: Payment */}
              <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Compra Concluída" : "Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado ✓" : "Pagamento único via checkout seguro"} status={paymentConfirmed ? "completed" : getStepStatus("payment")} isLast>
                {paymentConfirmed ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                    <p className="text-sm text-muted-foreground">Redirecionando...</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Valor total: <strong className="text-primary">R$ {promoPrice.toFixed(2).replace(".", ",")}</strong> — Pagamento único
                    </p>
                    {paymentError && (
                      <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-destructive">Erro ao gerar cobrança</p>
                          <p className="text-xs text-muted-foreground mt-1">{paymentError}</p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { id: "BOLETO" as BillingType, icon: FileBarChart, label: "Boleto Bancário", desc: "Pagamento único" },
                        { id: "CREDIT_CARD" as BillingType, icon: CreditCard, label: "Cartão de Crédito", desc: "Pagamento único" },
                      ]).map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedPayment(method.id)}
                          className={`p-4 rounded-xl border-2 transition-all text-center ${
                            selectedPayment === method.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                          }`}
                        >
                          <method.icon className={`w-6 h-6 mx-auto mb-2 ${selectedPayment === method.id ? "text-primary" : "text-muted-foreground"}`} />
                          <p className="text-sm font-semibold text-foreground">{method.label}</p>
                          <p className="text-xs text-muted-foreground">{method.desc}</p>
                        </button>
                      ))}
                    </div>
                    <Button onClick={handlePayment} disabled={!selectedPayment || paymentLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
                      <ExternalLink className="w-5 h-5 mr-2" />
                      PROSSEGUIR PARA PAGAMENTO
                    </Button>
                  </div>
                )}
              </WizardStepWrapper>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── FLUXO RECORRENTE: Calculadora de infra → ContractingWizard */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {contractMode === "recorrente" && !(Number(searchParams.get("total_mensal") || 0) > 0) && (
          <div>
            {(() => { console.log("[WMTi] RECURRING_INFRA_CALCULATOR_RENDERED — administracao-de-servidores"); return null; })()}

            {/* Prevention messaging */}
            <div className="section-dark pt-6 pb-0">
              <div className="container max-w-3xl">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-primary/5 border border-primary/20 rounded-xl p-5"
                >
                  <p className="text-sm text-foreground leading-relaxed">
                    <strong>Empresas que não monitoram seus servidores</strong> descobrem o problema quando já perderam dados ou ficaram horas paradas. Com o plano recorrente, você tem monitoramento 24h, atualizações, backup e SLA garantido.
                  </p>
                </motion.div>
              </div>
            </div>

            <UnifiedInfraCalculator
              contractHref={`/contratar/${slug}`}
              pageTitle="Administração de Servidores"
            />
          </div>
        )}

        {contractMode === "recorrente" && Number(searchParams.get("total_mensal") || 0) > 0 && (
          <div>
            {(() => {
              console.log("[WMTi] CHECKOUT_STARTED_RECORRENTE — administracao-de-servidores", { serverHosts, serverVms, serverMonthlyValue });
              return null;
            })()}

            {/* Recurring summary badges */}
            <div className="section-dark pt-6 pb-2">
              <div className="container max-w-3xl">
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                    <span className="text-muted-foreground">Hosts: </span><strong className="text-primary">{serverHosts}</strong>
                  </div>
                  {serverVms > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                      <span className="text-muted-foreground">VMs: </span><strong className="text-primary">{serverVms}</strong>
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                    <span className="text-muted-foreground">Mensalidade: </span><strong className="text-primary">R$ {serverMonthlyValue.toLocaleString("pt-BR")}/mês</strong>
                  </div>
                </div>
              </div>
            </div>

            <ContractingWizard
              visible={true}
              effectivePath="suporte"
              serviceSlug="administracao-de-servidores"
              plan={{ id: "server-admin", name: "Administração de Servidores", cpu: `${serverHosts} Host(s)`, ram: `${serverVms} VM(s)`, ssd: "Monitoramento contínuo", extras: ["Manutenção preventiva", "Permanência mínima 12 meses"], price: serverMonthlyValue, popular: false }}
              qualification={null}
              computersQty={serverHosts + serverVms}
              monthlyValue={serverMonthlyValue}
              quoteId={null}
              customRegistrationForm={(onComplete, loading) => (
                <ServerAdminRegistrationForm
                  onComplete={async (data: ServerAdminRegistrationData) => {
                    const fullAddress = [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");
                    const mapped: RegistrationData = {
                      razaoSocial: data.razaoSocial,
                      nomeFantasia: data.nomeFantasia,
                      cnpjOuCpf: data.cnpj,
                      responsavel: data.responsavelNome,
                      email: data.responsavelEmail,
                      telefone: data.responsavelTelefone,
                      cep: data.cep,
                      endereco: data.logradouro,
                      numero: data.numero,
                      complemento: data.complemento,
                      bairro: data.bairro,
                      cidade: data.cidade,
                      uf: data.uf,
                      isPJ: true,
                      representanteCpf: data.responsavelCpf,
                    };
                    await onComplete(mapped);
                  }}
                  loading={loading}
                />
              )}
            />
          </div>
        )}

        {/* Show prompt if no mode selected yet */}
        {!contractMode && (
          <div className="section-dark py-12">
            <div className="container max-w-3xl text-center">
              <p className="text-muted-foreground font-body">
                Selecione o modelo de contratação acima para prosseguir.
              </p>
            </div>
          </div>
        )}

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SeoHead
        title={`Contratar ${serviceName} | WMTi`}
        description={`Contrate ${serviceName} com a WMTi. Calculadora de horas técnicas com desconto progressivo.`}
      />
      <Navbar />

      <section className="section-dark pt-24 md:pt-28 pb-8 border-b-4 border-primary">
        <div className="container">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1 font-mono text-xs text-muted-foreground/50">
              <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
              <ChevronRight size={10} className="shrink-0" />
              {service && (
                <>
                  <li><Link to={`/${service.slug}`} className="hover:text-primary transition-colors">{serviceName}</Link></li>
                  <ChevronRight size={10} className="shrink-0" />
                </>
              )}
              <li className="text-primary" aria-current="page">{t("contratar.breadcrumbContratar")}</li>
            </ol>
          </nav>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t("contratar.tag")}</p>
          <h1 className="text-2xl md:text-4xl lg:text-5xl mb-4">
            {t("contratar.titlePrefix")} <span className="text-primary">{serviceName}</span>
          </h1>
          <p className="font-body text-lg text-muted-foreground/70 max-w-2xl leading-relaxed">
            {isEmergency
              ? t("contratar.emergencialDesc")
              : t("contratar.avulsoDesc")}
          </p>
        </div>
      </section>

      <div ref={wizardRef} className="section-dark py-12 md:py-16">
        <div className="container max-w-3xl">

          {/* Step 1: Calculator */}
          <WizardStepWrapper stepNumber={1} title={t("contratar.stepCalculator")} subtitle={t("contratar.stepCalculatorSub")} status={getStepStatus("calculator")}>
            <div className="space-y-6">
              {/* Service badge */}
              <div className="bg-secondary p-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{t("contratar.servicoSelecionado")}</p>
                  <p className="font-bold text-foreground">{serviceName}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">{isEmergency ? t("contratar.emergencial") : t("contratar.avulso")}</p>
                  <p className="font-bold text-primary">R$ {basePrice.toFixed(2).replace(".", ",")}/h</p>
                </div>
              </div>

              {/* Hours control */}
              <div className="bg-secondary p-8">
                <div className="flex items-center justify-center gap-6 mb-6">
                  <button onClick={() => setHours(Math.max(1, hours - 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Diminuir horas">
                    <Minus size={20} />
                  </button>
                  <div className="text-center">
                    <span className="text-5xl font-bold text-primary">{hours}</span>
                    <p className="font-mono text-xs text-muted-foreground mt-1">{hours} {t("contratar.horasTecnicas")}</p>
                  </div>
                  <button onClick={() => setHours(Math.min(8, hours + 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Aumentar horas">
                    <Plus size={20} />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Clock size={14} /> {t("contratar.valorPorHora")}</span>
                    <span className="text-foreground">
                      R$ {unitPrice.toFixed(2).replace(".", ",")}
                      {discountPct > 0 && <span className="ml-2 text-xs text-primary">-{discountPct}%</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="text-muted-foreground">{t("contratar.precoCheio")}</span>
                    <span className="text-muted-foreground/50 line-through">R$ {fullPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="h-px bg-muted-foreground/10" />
                  <div className="flex items-center justify-between font-mono text-base font-bold">
                    <span className="text-foreground">{t("contratar.precoPromocional")}</span>
                    <span className="text-primary text-xl">R$ {promoPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>

                {savings > 0 && (
                  <div className="bg-primary/10 border border-primary/30 p-4 flex items-center gap-3">
                    <TrendingDown size={20} className="text-primary shrink-0" />
                    <p className="font-mono text-sm font-bold text-primary">
                      {t("contratar.economizando")} R$ {savings.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                )}
              </div>

              {/* Discount table */}
              <details className="bg-secondary group">
                <summary className="p-4 cursor-pointer font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex justify-between items-center">
                  {t("contratar.verTabela")}
                  <Plus size={14} className="text-primary group-open:rotate-45 transition-transform" />
                </summary>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-px text-xs font-mono">
                    <div className="bg-secondary p-2 text-muted-foreground/50">{t("contratar.tabelaHoras")}</div>
                    <div className="bg-secondary p-2 text-muted-foreground/50">R$/h</div>
                    <div className="bg-secondary p-2 text-muted-foreground/50">{t("contratar.tabelaTotal")}</div>
                    {Object.entries(priceTable).map(([h, price]) => (
                      <div key={h} className={`contents ${Number(h) === hours ? "[&>div]:text-primary [&>div]:font-bold" : ""}`}>
                        <div className="bg-secondary/50 p-2 text-muted-foreground">{h}h</div>
                        <div className="bg-secondary/50 p-2 text-muted-foreground">R$ {price.toFixed(2).replace(".", ",")}</div>
                        <div className="bg-secondary/50 p-2 text-muted-foreground">R$ {(Number(h) * price).toFixed(2).replace(".", ",")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              {/* Continue button */}
              <button
                onClick={handleContinueToRegistration}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <ArrowRight size={16} />
                {t("contratar.continuarContratacao")}
              </button>
              <p className="font-body text-xs text-center text-muted-foreground/60">
                {t("contratar.continuarDesc")}
              </p>
            </div>
          </WizardStepWrapper>

          {/* Step 2: Registration */}
          <WizardStepWrapper stepNumber={2} title={t("contratar.stepRegistration")} subtitle={t("contratar.stepRegistrationSub")} status={getStepStatus("registration")}>
            <QuickRegistrationForm onComplete={handleRegistrationComplete} loading={registrationLoading} initialData={{}} />
          </WizardStepWrapper>

          {/* Step 3: Contract */}
          <WizardStepWrapper stepNumber={3} title="Contrato e Assinatura" subtitle={contractSigned ? "Contrato assinado ✓" : "Leia e assine o contrato"} status={getStepStatus("contract")}>
            {contractSigned ? (
              <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                <h4 className="text-lg font-heading font-bold">Contrato assinado!</h4>
                <p className="text-sm text-muted-foreground">Prossiga para o pagamento abaixo.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-semibold text-sm">Contrato de Horas Técnicas — {serviceName}</p>
                      <p className="text-xs text-muted-foreground">O contrato será aberto em uma página separada com aparência de documento formal.</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Após ler e assinar o contrato, esta página será atualizada automaticamente.</p>
                </div>
                <Button onClick={handleOpenContract} disabled={!contractId} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir contrato para leitura e assinatura
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                  Aguardando assinatura do contrato...
                </p>
              </div>
            )}
          </WizardStepWrapper>

          {/* Step 4: Payment */}
          <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Compra Concluída" : "Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado ✓" : "Pagamento único via checkout seguro"} status={paymentConfirmed ? "completed" : getStepStatus("payment")} isLast>
             {paymentConfirmed ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                  <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                  <p className="text-sm text-muted-foreground">Redirecionando para a página de confirmação...</p>
                  <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                </div>
            ) : paymentLoading ? (
              <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
                <div className="flex flex-col items-center text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <h4 className="text-lg font-heading font-bold">Conectando ao checkout...</h4>
                  <p className="text-sm text-muted-foreground">Não feche esta página.</p>
                </div>
              </div>
            ) : paymentComplete && invoiceUrl ? (
              <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
               <div className="flex flex-col items-center text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <h4 className="text-lg font-heading font-bold">Aguardando confirmação do pagamento...</h4>
                  {popupBlocked ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-left">
                      <p className="text-sm text-amber-300 font-semibold mb-1">⚠️ O navegador bloqueou a abertura automática</p>
                      <p className="text-xs text-muted-foreground">Clique no botão abaixo para abrir o checkout manualmente.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">A página segura de pagamento foi aberta em outra aba. Conclua o pagamento por lá.</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => { setPopupBlocked(false); const w = window.open(invoiceUrl!, "_blank", "noopener,noreferrer"); if (!w) setPopupBlocked(true); }} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {popupBlocked ? "Abrir checkout" : "Abrir checkout novamente"}
                  </Button>
                </div>
                <div className="text-center mt-4 space-y-2">
                  <p className="font-mono text-sm font-bold text-primary">Resumo da compra</p>
                  <p className="text-sm text-muted-foreground">Serviço: <strong className="text-foreground">{serviceName}</strong></p>
                  <p className="text-sm text-muted-foreground">Horas: <strong className="text-foreground">{hours}</strong></p>
                  <p className="text-sm text-muted-foreground">Valor total: <strong className="text-primary">R$ {promoPrice.toFixed(2).replace(".", ",")}</strong></p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Valor total: <strong className="text-primary">R$ {promoPrice.toFixed(2).replace(".", ",")}</strong> — Pagamento único
                </p>

                {paymentError && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">Erro ao gerar cobrança</p>
                      <p className="text-xs text-muted-foreground mt-1">{paymentError}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: "BOLETO" as BillingType, icon: FileBarChart, label: "Boleto Bancário", desc: "Pagamento único" },
                    { id: "CREDIT_CARD" as BillingType, icon: CreditCard, label: "Cartão de Crédito", desc: "Pagamento único" },
                  ]).map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedPayment(method.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selectedPayment === method.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <method.icon className={`w-6 h-6 mx-auto mb-2 ${selectedPayment === method.id ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-semibold text-foreground">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.desc}</p>
                    </button>
                  ))}
                </div>

                <Button onClick={handlePayment} disabled={!selectedPayment || paymentLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  {paymentError ? "Tentar novamente" : "PROSSEGUIR PARA PAGAMENTO"}
                </Button>
              </div>
            )}
          </WizardStepWrapper>
        </div>
      </div>

      <Footer />
    </div>
  );
};

/* ─── Hours-specific contract HTML generator ─── */
function generateHoursContractHtml(
  customer: CustomerData,
  serviceName: string,
  isEmergency: boolean,
  hours: number,
  unitPrice: number,
  totalValue: number,
  savings: number,
) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const serviceType = isEmergency ? "EMERGENCIAL" : "AVULSO SOB DEMANDA";

  return `
<div style="font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.8; font-size: 12pt; text-align: justify;">

  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #000;">
    <p style="font-size: 14pt; font-weight: bold; margin: 0;">WMTi Tecnologia da Informação</p>
    <h1 style="font-size: 14pt; font-weight: bold; margin: 16px 0 0 0; text-transform: uppercase;">
      CONTRATO DE PRESTAÇÃO DE SERVIÇO TÉCNICO — PACOTE PRÉ-PAGO DE HORAS
    </h1>
  </div>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>

  <p><strong>CONTRATANTE:</strong> Razão Social: ${customer.razaoSocial}${customer.nomeFantasia ? `, Nome fantasia: ${customer.nomeFantasia}` : ""}, com sede em ${customer.endereco}, CIDADE DE ${customer.cidade}, com CEP ${customer.cep}, inscrita no ${customer.cnpjOuCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} sob o nº ${customer.cnpjOuCpf}, neste ato representada por ${customer.responsavel}, adiante denominado simplesmente CONTRATANTE.${customer.email ? ` E-mail: ${customer.email}.` : ""}${customer.telefone ? ` Telefone: ${customer.telefone}.` : ""}</p>

  <p><strong>CONTRATADA:</strong> WMTI TECNOLOGIA DA INFORMAÇÃO LTDA, pessoa jurídica privada, inscrita no CNPJ sob nº 13.366.668/0001-07, com sede na RUA JOSÉ BENEDITO DUARTE, 140, PARQUE ITAMARATI, CEP: 12.307-200, na CIDADE DE JACAREÍ no ESTADO DE SÃO PAULO, adiante denominada simplesmente como CONTRATADA.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO OBJETO DO CONTRATO</h2>

  <p><strong>Cláusula Primeira</strong> – O presente contrato tem como OBJETO a contratação de pacote pré-pago de horas técnicas para a prestação do serviço de <strong>${serviceName}</strong>, modalidade <strong>${serviceType}</strong>, conforme especificações abaixo:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Serviço</td>
      <td style="border: 1px solid #000; padding: 8px;">${serviceName}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Modalidade</td>
      <td style="border: 1px solid #000; padding: 8px;">${serviceType}</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Quantidade de Horas</td>
      <td style="border: 1px solid #000; padding: 8px;">${hours} hora${hours > 1 ? "s" : ""} técnica${hours > 1 ? "s" : ""}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor por Hora</td>
      <td style="border: 1px solid #000; padding: 8px;">R$ ${unitPrice.toFixed(2).replace(".", ",")}</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor Total</td>
      <td style="border: 1px solid #000; padding: 8px;"><strong>R$ ${totalValue.toFixed(2).replace(".", ",")}</strong></td>
    </tr>
    ${savings > 0 ? `<tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Economia Obtida</td>
      <td style="border: 1px solid #000; padding: 8px; color: green;">R$ ${savings.toFixed(2).replace(".", ",")}</td>
    </tr>` : ""}
  </table>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DA UTILIZAÇÃO DAS HORAS</h2>

  <p><strong>Cláusula Segunda</strong> – As horas técnicas contratadas poderão ser utilizadas pelo CONTRATANTE para o serviço descrito na Cláusula Primeira, mediante agendamento prévio com a CONTRATADA.</p>

  <p><strong>Cláusula Terceira</strong> – O atendimento será prestado de forma remota ou presencial, conforme a necessidade e a critério da CONTRATADA, no endereço: ${customer.endereco}, ${customer.cidade}, CEP ${customer.cep}.</p>

  <p><strong>Cláusula Quarta</strong> – As horas contratadas são válidas por 90 (noventa) dias a partir da data de confirmação do pagamento. Horas não utilizadas dentro deste prazo serão consideradas consumidas.</p>

  ${isEmergency ? `<p><strong>Cláusula Quinta</strong> – Por se tratar de atendimento emergencial, a CONTRATADA envidará esforços para iniciar o atendimento em até 4 (quatro) horas úteis após a solicitação do CONTRATANTE, sujeito à disponibilidade da equipe técnica.</p>` : `<p><strong>Cláusula Quinta</strong> – O agendamento do atendimento será realizado com antecedência mínima de 24 (vinte e quatro) horas úteis, sujeito à disponibilidade da equipe técnica da CONTRATADA.</p>`}

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO PAGAMENTO</h2>

  <p><strong>Cláusula Sexta</strong> – O CONTRATANTE deverá efetuar o pagamento integral do valor de <strong>R$ ${totalValue.toFixed(2).replace(".", ",")}</strong> antes do início da prestação dos serviços, por meio de boleto bancário, PIX ou cartão de crédito.</p>

  <p><strong>Cláusula Sétima</strong> – O início da prestação dos serviços está condicionado à confirmação do pagamento pela CONTRATADA.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS OBRIGAÇÕES DA CONTRATADA</h2>

  <p><strong>Cláusula Oitava</strong> – A CONTRATADA obriga-se a:</p>
  <p>a) Executar os serviços com diligência e qualidade técnica;</p>
  <p>b) Manter sigilo sobre informações obtidas durante a prestação dos serviços;</p>
  <p>c) Informar ao CONTRATANTE o saldo de horas restantes quando solicitado;</p>
  <p>d) Emitir nota fiscal correspondente ao serviço prestado.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS OBRIGAÇÕES DO CONTRATANTE</h2>

  <p><strong>Cláusula Nona</strong> – O CONTRATANTE obriga-se a:</p>
  <p>a) Disponibilizar acesso remoto ou presencial aos equipamentos quando necessário;</p>
  <p>b) Designar um responsável para acompanhar os serviços;</p>
  <p>c) Efetuar o pagamento conforme estabelecido neste contrato.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO ACEITE ELETRÔNICO</h2>

  <p><strong>Cláusula Décima</strong> – O presente contrato é celebrado de forma eletrônica, sendo a assinatura digital do CONTRATANTE considerada válida e vinculante para todos os efeitos legais, nos termos da Medida Provisória nº 2.200-2/2001.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO FORO</h2>

  <p><strong>Cláusula Décima Primeira</strong> – Fica eleito o Foro da Comarca de Jacareí/SP para dirimir quaisquer questões oriundas do presente contrato.</p>

  <p style="margin-top: 32px;">E, por estarem assim justas e contratadas, as partes assinam o presente Contrato eletronicamente.</p>

  <p style="margin-top: 24px; text-align: center;">Jacareí (SP), ${today}</p>

  <div style="margin-top: 48px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;">
      <div style="border-top: 1px solid #000; padding-top: 8px;">
        <p style="margin: 0;"><strong>${customer.responsavel}</strong></p>
        <p style="margin: 0; font-size: 10pt;">${customer.cnpjOuCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}: ${customer.cnpjOuCpf}</p>
        <p style="margin: 0; font-size: 10pt;">CONTRATANTE</p>
      </div>
    </div>
    <div style="text-align: center; width: 45%;">
      <div style="border-top: 1px solid #000; padding-top: 8px;">
        <p style="margin: 0;"><strong>Willian Rodrigues da Silva</strong></p>
        <p style="margin: 0; font-size: 10pt;">CPF: 377.995.388-99</p>
        <p style="margin: 0; font-size: 10pt;">CONTRATADA — WMTi</p>
      </div>
    </div>
  </div>

  <div data-traceability="true" style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #999;">
    <h2 style="font-size: 10pt; font-weight: bold; margin-bottom: 8px; color: #333;">Dados de Rastreabilidade da Assinatura Eletrônica</h2>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">IP de origem: <strong data-proof="ip">{{SIGN_IP}}</strong></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">Data da confirmação: <strong data-proof="date">{{SIGN_DATE}}</strong></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">Hora da confirmação: <strong data-proof="time">{{SIGN_TIME}}</strong></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">Identificação do navegador/dispositivo (User Agent): <strong data-proof="ua">{{SIGN_USER_AGENT}}</strong></p>
    <p style="font-size: 8pt; color: #888; margin-top: 12px; font-style: italic;">Este documento foi assinado eletronicamente nos termos do art. 10 da Medida Provisória nº 2.200-2/2001. Os dados acima constituem prova eletrônica da manifestação de vontade do signatário.</p>
  </div>

</div>
`;
}

export default ContratarServicoPage;
