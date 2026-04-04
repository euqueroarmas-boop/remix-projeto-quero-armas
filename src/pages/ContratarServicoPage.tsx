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
import { useInfraStore } from "@/stores/useInfraStore";
import { useCheckoutStore } from "@/stores/useCheckoutStore";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import WizardStepWrapper from "@/components/orcamento/WizardStepWrapper";
import QuickRegistrationForm, { type RegistrationData } from "@/components/orcamento/QuickRegistrationForm";
import { generateContractHtml } from "@/components/orcamento/ContractPreview";
import { generateOnDemandContractHtml, buildOnDemandVarsFromCheckout } from "@/lib/onDemandContractHtml";
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
  { name: "Desenvolvimento De Sites E Sistemas Web", slug: "desenvolvimento-de-sites-e-sistemas-web", isEmergency: false },
];

const CARTORIO_SEGMENT_CHECKOUT_ALIASES = new Set([
  "ti-para-cartorios",
  "ti-para-serventias-cartoriais",
  "ti-para-tabelionatos-de-notas",
  "ti-para-oficios-de-registro",
  "ti-para-tabelionatos-de-protesto",
]);

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
  const isLegacyCartorioRecurringCheckout = Boolean(
    slug &&
    CARTORIO_SEGMENT_CHECKOUT_ALIASES.has(slug) &&
    searchParams.get("modo") === "recorrente"
  );

  // Find service
  const service = SERVICE_CATALOG.find(s => s.slug === slug);
  const serviceName = service?.name || searchParams.get("servico") || "Serviço de TI";
  const isEmergency = service?.isEmergency || false;
  const isRentalContract = slug === "locacao-de-computadores-para-empresas-jacarei";
  const isServerAdmin = slug === "administracao-de-servidores";
  const isSupportTi = slug === "suporte-ti-jacarei";
  const isWebDev = slug === "desenvolvimento-de-sites-e-sistemas-web";
  const isFromServiceCalc = searchParams.get("source") === "service_calculator";
  const selectedRentalPlanId = searchParams.get("plano") || "equilibrio";
  const selectedRentalQty = Math.max(1, Number(searchParams.get("qty") || 1));
  const selectedRentalPlan = plans.find((item) => item.id === selectedRentalPlanId) || plans[1];
  const rentalMonthlyValue = selectedRentalPlan.price * selectedRentalQty;
  const basePrice = isServerAdmin ? 500 : isEmergency ? 300 : 200;
  const priceTable = isServerAdmin ? SERVER_ADMIN_PRICES : isEmergency ? EMERGENCY_PRICES : STANDARD_PRICES;

  // Hydrate store from URL params on mount
  const infraStore = useInfraStore();
  const checkoutStore = useCheckoutStore();
  useEffect(() => {
    infraStore.hydrateFromParams(searchParams);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Server admin params — read from store (which was hydrated from URL)
  const serverHosts = infraStore.recorrente.hosts;
  const serverVms = infraStore.recorrente.vms;
  const serverEstacoes = infraStore.recorrente.estacoes;
  const serverOsType = infraStore.recorrente.sistemaServidores;
  const serverSla = infraStore.recorrente.sla;
  const serverCriticidade = infraStore.recorrente.criticidade;
  const SERVER_HOST_PRICE = serverOsType === "linux" ? 500 : 350;
  const SERVER_VM_PRICE = serverOsType === "linux" ? 350 : 200;
  const WORKSTATION_BASE = 150;
  const MAX_DISCOUNT_PCT = 27.5;
  const MAX_AUTO_WS = 30;
  const wsDiscountPctCalc = serverEstacoes <= 1 ? 0 : serverEstacoes >= MAX_AUTO_WS ? MAX_DISCOUNT_PCT : (MAX_DISCOUNT_PCT * (serverEstacoes - 1)) / (MAX_AUTO_WS - 1);
  const wsGrossCalc = serverEstacoes * WORKSTATION_BASE;
  const wsDiscountCalc = wsGrossCalc * (wsDiscountPctCalc / 100);
  const wsSubtotalCalc = serverEstacoes > MAX_AUTO_WS ? 0 : wsGrossCalc - wsDiscountCalc;
  const serverBaseValue = serverHosts * SERVER_HOST_PRICE + serverVms * SERVER_VM_PRICE + wsSubtotalCalc;
  const slaMultiplier = serverSla === "24h" ? 1.35 : 1;
  const critMultiplier = serverCriticidade === "alto" ? 1.5 : serverCriticidade === "medio" ? 1.2 : 1;
  const serverMonthlyValue = Math.round(serverBaseValue * slaMultiplier * critMultiplier * 100) / 100;

  // Flow state
  const [currentStep, setCurrentStep] = useState<FlowStep>(
    isWebDev && isFromServiceCalc && searchParams.get("horas") ? "registration" : "calculator"
  );
  const webDevPayload = isWebDev && isFromServiceCalc ? {
    tipoProjeto: searchParams.get("tipoProjeto") || "",
    horas: Number(searchParams.get("horas") || 1),
    complexidade: searchParams.get("complexidade") || "",
    urgencia: searchParams.get("urgencia") || "",
    prazo: searchParams.get("prazo") || "",
    continuidade: searchParams.get("continuidade") || "",
    observacoes: searchParams.get("observacoes") || "",
    valorHora: Number(searchParams.get("valorHora") || 200),
    subtotal: Number(searchParams.get("subtotal") || 0),
    descontoAplicado: Number(searchParams.get("descontoAplicado") || 0),
    multiplicadorPrazoUrgencia: Number(searchParams.get("multiplicadorPrazoUrgencia") || 1),
    multiplicadorComplexidade: Number(searchParams.get("multiplicadorComplexidade") || 1),
    totalFinal: Number(searchParams.get("totalFinal") || 0),
  } : null;
  const [hours, setHours] = useState(webDevPayload?.horas || 1);
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
  const [paymentReady, setPaymentReady] = useState(false);
  const [boletoGenerated, setBoletoGenerated] = useState(false);
  const [contractMode, setContractMode] = useState<ContractMode | null>(
    (searchParams.get("modo") as ContractMode) || null
  );

  // Calculations
  const unitPrice = webDevPayload ? webDevPayload.valorHora : (priceTable[Math.min(hours, 8)] ?? (isEmergency ? 217.5 : 145));
  const fullPrice = hours * basePrice;
  const promoPrice = webDevPayload ? webDevPayload.totalFinal : hours * unitPrice;
  const savings = webDevPayload ? webDevPayload.descontoAplicado : fullPrice - promoPrice;
  const discountPct = hours > 1 ? Math.round(((basePrice - unitPrice) / basePrice) * 100) : 0;

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  // ─── Checkout persistence: rehydrate on mount ───
  useEffect(() => {
    if (!slug) return;
    const saved = checkoutStore.getSafeSession(slug);
    if (!saved) return;
    // Restore IDs (prevent duplication)
    if (saved.quoteId) setQuoteId(saved.quoteId);
    if (saved.customerId) setCustomerId(saved.customerId);
    if (saved.contractId) setContractId(saved.contractId);
    if (saved.contractSigned) setContractSigned(true);
    if (saved.registrationData) setRegistrationData(saved.registrationData as any);
    if (saved.selectedPayment) setSelectedPayment(saved.selectedPayment);
    if (saved.invoiceUrl) setInvoiceUrl(saved.invoiceUrl);
    if (saved.paymentComplete) setPaymentComplete(true);
    if (saved.paymentReady) setPaymentReady(true);
    if (saved.hours > 1) setHours(saved.hours);
    if (saved.contractMode) setContractMode(saved.contractMode as any);
    // Restore step
    if (saved.onDemandStep && saved.onDemandStep !== "calculator") {
      setCurrentStep(saved.onDemandStep as FlowStep);
    }
    console.log("[WMTi] Checkout session restored from persistence", { step: saved.onDemandStep, quoteId: saved.quoteId });
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Checkout persistence: auto-save on changes ───
  useEffect(() => {
    if (!slug) return;
    // Only save if there's meaningful progress
    if (!registrationData && currentStep === "calculator") return;
    checkoutStore.patch({
      flowType: "on_demand",
      serviceSlug: slug,
      onDemandStep: currentStep,
      quoteId,
      customerId,
      contractId,
      registrationData: registrationData ? {
        razaoSocial: registrationData.razaoSocial,
        nomeFantasia: registrationData.nomeFantasia,
        cnpjOuCpf: registrationData.cnpjOuCpf,
        responsavel: registrationData.responsavel,
        responsavelCpf: registrationData.responsavelCpf,
        email: registrationData.email,
        telefone: registrationData.telefone,
        whatsapp: registrationData.whatsapp,
        cep: registrationData.cep,
        endereco: registrationData.endereco,
        numero: registrationData.numero,
        complemento: registrationData.complemento,
        bairro: registrationData.bairro,
        cidade: registrationData.cidade,
        uf: registrationData.uf,
        isPJ: registrationData.isPJ,
      } : null,
      selectedPayment,
      invoiceUrl,
      paymentComplete,
      contractSigned,
      paymentReady,
      hours,
      contractMode: contractMode as any,
    });
  }, [currentStep, quoteId, customerId, contractId, registrationData, selectedPayment, invoiceUrl, paymentComplete, contractSigned, paymentReady, hours, contractMode, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLegacyCartorioRecurringCheckout) return;

    const redirectParams = new URLSearchParams(searchParams);
    redirectParams.set("modo", "recorrente");
    navigate(`/contratar/administracao-de-servidores?${redirectParams.toString()}`, { replace: true });
  }, [isLegacyCartorioRecurringCheckout, navigate, searchParams]);

  // On mount: check if URL has a quote with confirmed payment (resilient return)
  useEffect(() => {
    const urlQuote = searchParams.get("quote");
    if (!urlQuote || paymentConfirmed) return;
    (async () => {
      const { data } = await supabase.functions.invoke("check-payment-status", {
        body: { quote_id: urlQuote },
      });
      if (data && isPaidStatus(data?.payment_status)) {
        setQuoteId(urlQuote);
        setPaymentConfirmed(true);
        const purchaseData = {
          serviceName, hours, monthlyValue: promoPrice, isRecurring: false,
          customerName: "", customerCpfCnpj: "", customerEmail: "",
          paymentMethod: (data as any).billing_type || "CREDIT_CARD",
          contractId, purchaseDate: new Date().toLocaleDateString("pt-BR"),
        };
        try { sessionStorage.setItem("wmti_purchase_data", JSON.stringify(purchaseData)); } catch {}
        checkoutStore.reset();
        navigate(`/compra-concluida?quote=${urlQuote}`);
      } else if (data && (data as any).asaas_invoice_url) {
        // Payment exists but pending — check if it's a boleto
        setQuoteId(urlQuote);
        setInvoiceUrl((data as any).asaas_invoice_url);
        setCurrentStep("payment");
        const billingType = (data as any).billing_type || "";
        if (billingType === "BOLETO") {
          setBoletoGenerated(true);
          setPaymentComplete(true);
        } else {
          setPaymentComplete(true);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Poll for payment confirmation — runs whenever we have a quoteId and are on/past payment step
  useEffect(() => {
    if (paymentConfirmed || !quoteId || boletoGenerated) return;
    // Only poll if payment was initiated or we're on the payment step
    if (!paymentComplete && currentStep !== "payment") return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("check-payment-status", {
          body: { quote_id: quoteId },
        });
        if (data && isPaidStatus(data?.payment_status)) {
          setPaymentConfirmed(true);
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
          checkoutStore.reset();
          navigate(`/compra-concluida?quote=${quoteId}`);
        }
      } catch (e) { console.error("[poll] check-payment-status error:", e); }
    }, 3000);
    return () => clearInterval(interval);
  }, [paymentComplete, paymentConfirmed, quoteId, currentStep, registrationData, selectedPayment, contractId, serviceName, hours, promoPrice, boletoGenerated]);

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
        ...data,
        endereco: fullAddress,
        cidade: `${data.cidade}/${data.uf}`,
      };

      const onDemandVars = buildOnDemandVarsFromCheckout({
        customer: {
          razaoSocial: data.razaoSocial,
          nomeFantasia: data.nomeFantasia,
          cnpjOuCpf: data.cnpjOuCpf,
          responsavel: data.responsavel,
          cpfResponsavel: data.responsavelCpf,
          email: data.email,
          whatsapp: data.whatsapp,
          telefone: data.telefone,
          endereco: fullAddress,
          cidade: `${data.cidade}/${data.uf}`,
          cep: data.cep,
        },
        serviceName,
        serviceSlug: slug || "",
        isEmergency,
        hours,
        unitPrice,
        totalValue: promoPrice,
        savings,
        valorHoraBase: basePrice,
        multiplicadorComplexidade: webDevPayload?.multiplicadorComplexidade,
        multiplicadorPrazoUrgencia: webDevPayload?.multiplicadorPrazoUrgencia,
        descontoProgressivoPct: discountPct > 0 ? discountPct : undefined,
        valorFinalHora: promoPrice / hours,
        fatorExecucaoLabel: webDevPayload?.urgencia || undefined,
      });
      const html = generateOnDemandContractHtml(onDemandVars);

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

  const paymentLockRef = useRef(false);

  if (isLegacyCartorioRecurringCheckout) {
    return null;
  }

  const handlePayment = async () => {
    if (!selectedPayment) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }
    if (!registrationData || !quoteId) {
      console.error("[WMTi][payment] Estado incompleto:", { hasRegistration: !!registrationData, quoteId });
      toast({ title: "Dados incompletos", description: "Preencha os dados da empresa novamente.", variant: "destructive" });
      return;
    }
    // Prevent double-click / concurrent calls
    if (paymentLockRef.current) {
      console.warn("[WMTi][payment] Chamada duplicada bloqueada");
      return;
    }
    paymentLockRef.current = true;
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

      // If already paid, redirect immediately
      if (data?.already_paid) {
        setPaymentConfirmed(true);
        checkoutStore.reset();
        navigate(`/compra-concluida?quote=${quoteId}`);
        return;
      }

      const url = data?.invoiceUrl || data?.invoice_url || data?.bankSlipUrl || data?.payment?.invoiceUrl;
      if (!url) throw new Error("O sistema de pagamento não retornou um link de cobrança.");

      setInvoiceUrl(url);
      setPopupBlocked(false);

      if (selectedPayment === "BOLETO") {
        // For boleto: don't poll, show success state immediately
        setBoletoGenerated(true);
        setPaymentComplete(true);
        // Open boleto in new tab
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        // For credit card: open checkout and start polling
        setPaymentComplete(true);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win || win.closed || typeof win.closed === "undefined") {
          setPopupBlocked(true);
          console.warn("[WMTi] Popup bloqueado pelo navegador");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[WMTi][payment]", message);
      setPaymentError(message);
    } finally {
      setPaymentLoading(false);
      paymentLockRef.current = false;
    }
  };

  const getStepStatus = (step: FlowStep) => {
    const order: FlowStep[] = ["calculator", "registration", "contract", "payment", "success"];
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
    const recurringHosts = infraStore.recorrente.hosts;
    const recurringVms = infraStore.recorrente.vms;
    const recurringEstacoes = infraStore.recorrente.estacoes;
    const recurringTotalMensal = Number(searchParams.get("total_mensal") || 0);
    const hasRecurringParams = recurringTotalMensal > 0 || recurringHosts > 1 || recurringVms > 0 || recurringEstacoes > 0;

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
              <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Pagamento Confirmado ✓" : boletoGenerated ? "Boleto Gerado ✓" : paymentComplete ? "Aguardando Confirmação" : paymentReady ? "Pagamento" : "Revisão e Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado com sucesso" : boletoGenerated ? "Boleto gerado — aguardando compensação" : paymentComplete ? "Processando seu pagamento..." : paymentReady ? "Pagamento único via checkout seguro" : "Confirme os dados e prepare o pagamento"} status={paymentConfirmed || boletoGenerated ? "completed" : getStepStatus("payment")}>
                {paymentConfirmed ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                    <p className="text-sm text-muted-foreground">Preparando a conclusão da sua compra...</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </div>
                ) : boletoGenerated ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-4">
                    <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                    <h4 className="text-lg font-heading font-bold text-foreground">Boleto gerado com sucesso!</h4>
                    <p className="text-sm text-muted-foreground">
                      Seu cadastro, contrato e pedido foram criados. O serviço será ativado automaticamente após a compensação do boleto.
                    </p>
                    <div className="pt-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Cadastro criado</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Contrato gerado</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Boleto emitido</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs justify-center">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-muted-foreground">Aguardando compensação bancária</span>
                      </div>
                    </div>
                    {invoiceUrl && (
                      <Button
                        onClick={() => window.open(invoiceUrl, "_blank", "noopener,noreferrer")}
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir boleto / 2ª via
                      </Button>
                    )}
                    <div className="bg-secondary/50 rounded-lg p-4 text-left space-y-2">
                      <p className="text-xs font-semibold text-foreground">Resumo da compra</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Serviço: <strong className="text-foreground">{serviceName}</strong></p>
                        <p>Horas: <strong className="text-foreground">{hours}</strong></p>
                        <p>Valor total: <strong className="text-primary">R$ {promoPrice.toFixed(2).replace(".", ",")}</strong></p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/60 font-mono">
                      Após a compensação, você receberá um e-mail com as credenciais de acesso ao portal.
                    </p>
                  </div>
                ) : paymentComplete ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <h4 className="text-lg font-heading font-bold text-foreground">Aguardando confirmação do pagamento</h4>
                    <p className="text-sm text-muted-foreground">
                      Complete o pagamento na janela do checkout. Assim que for confirmado, seu pedido será finalizado automaticamente.
                    </p>
                    {invoiceUrl && (
                      <div className="space-y-2">
                        {popupBlocked && (
                          <p className="text-xs text-amber-500 font-mono">⚠ A janela de pagamento pode ter sido bloqueada pelo navegador.</p>
                        )}
                        <Button
                          onClick={() => window.open(invoiceUrl, "_blank", "noopener,noreferrer")}
                          variant="outline"
                          className="w-full h-12 border-primary text-primary hover:bg-primary/10"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {popupBlocked ? "Abrir checkout de pagamento" : "Reabrir checkout de pagamento"}
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground/60 font-mono">Verificando a cada 5 segundos...</p>
                  </div>
                ) : !paymentReady ? (
                  <div className="space-y-4">
                    {/* Phase A: Preparation confirmation */}
                    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-2 font-bold">Resumo do pedido</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span className="text-foreground font-semibold">{serviceName}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Horas</span><span className="text-foreground font-semibold">{hours}h</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Valor total</span><span className="text-primary font-bold">R$ {promoPrice.toFixed(2).replace(".", ",")}</span></div>
                        {registrationData && <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span className="text-foreground font-semibold">{registrationData.razaoSocial}</span></div>}
                      </div>
                      <div className="pt-2 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">Cadastro salvo</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">Contrato gerado</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">Pedido registrado</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => setPaymentReady(true)}
                      className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <ShieldCheck className="w-5 h-5 mr-2" />
                      Ir para pagamento seguro
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Phase B: Payment method selection */}
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

              {/* Step 5: Conclusão */}
              <WizardStepWrapper stepNumber={5} title="Conclusão" subtitle="Fechamento e ativação do serviço" status={paymentConfirmed ? "active" : "pending"} isLast>
                {paymentConfirmed ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Finalizando seu pedido...</h4>
                    <p className="text-sm text-muted-foreground">Gerando credenciais e ativando seu serviço.</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Aguardando confirmação do pagamento para finalizar.</p>
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
                    await onComplete(data);
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
                    COMPRAR AGORA
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
              <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Pagamento Confirmado ✓" : "Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado com sucesso" : "Pagamento único via checkout seguro"} status={paymentConfirmed ? "completed" : getStepStatus("payment")}>
                {paymentConfirmed ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                    <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                    <p className="text-sm text-muted-foreground">Avançando para a conclusão...</p>
                  </div>
                ) : paymentComplete && invoiceUrl ? (
                  <div className="space-y-4">
                    {/* Status indicators after boleto/payment generation */}
                    <div className="bg-card border border-primary/20 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-foreground font-semibold">Cadastro criado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-foreground font-semibold">Contrato gerado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-foreground font-semibold">{selectedPayment === "BOLETO" ? "Boleto gerado" : "Cobrança gerada"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                        <span className="text-sm text-muted-foreground font-semibold">Aguardando pagamento</span>
                      </div>
                    </div>

                    {selectedPayment === "BOLETO" && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Seu acesso restrito ao portal do cliente já foi liberado. Após a compensação do boleto, o acesso completo será ativado automaticamente.
                        </p>
                      </div>
                    )}

                    <Button onClick={() => window.open(invoiceUrl!, "_blank", "noopener,noreferrer")} variant="outline" className="w-full h-12">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {selectedPayment === "BOLETO" ? "Abrir boleto" : "Ir para pagamento"}
                    </Button>

                    {popupBlocked && (
                      <p className="text-xs text-center text-muted-foreground">
                        O link foi bloqueado pelo navegador. Clique no botão acima para abrir.
                      </p>
                    )}

                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Verificando confirmação de pagamento automaticamente...
                    </p>
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
                      {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ExternalLink className="w-5 h-5 mr-2" />}
                      {paymentError ? "Tentar novamente" : "COMPRAR AGORA"}
                    </Button>
                  </div>
                )}
              </WizardStepWrapper>

              {/* Step 5: Conclusão */}
              <WizardStepWrapper stepNumber={5} title="Compra Concluída" subtitle="Fechamento e ativação do serviço" status={paymentConfirmed ? "active" : "pending"} isLast>
                {paymentConfirmed ? (
                  <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                    <h4 className="text-lg font-heading font-bold text-foreground">Pedido concluído com sucesso!</h4>
                    <p className="text-sm text-muted-foreground">Redirecionando para a página de confirmação...</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </div>
                ) : null}
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
                  {serverEstacoes > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                      <span className="text-muted-foreground">Estações: </span><strong className="text-primary">{serverEstacoes}</strong>
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                    <span className="text-muted-foreground">SO Servidores: </span><strong className="text-primary">{infraStore.recorrente.sistemaServidores === "windows_server" ? "Windows Server" : "Linux"}</strong>
                  </div>
                  {serverEstacoes > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                      <span className="text-muted-foreground">SO Estações: </span><strong className="text-primary">{infraStore.recorrente.sistemaEstacoes === "macos" ? "macOS" : infraStore.recorrente.sistemaEstacoes === "linux" ? "Linux" : "Windows"}</strong>
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
                    await onComplete(data);
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

          {/* Step 1: Calculator or Project Summary */}
          <WizardStepWrapper stepNumber={1} title={webDevPayload ? "Resumo do Projeto" : t("contratar.stepCalculator")} subtitle={webDevPayload ? "Dados preenchidos na calculadora do serviço" : t("contratar.stepCalculatorSub")} status={getStepStatus("calculator")}>
            {webDevPayload ? (
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-4 font-bold">Resumo do projeto</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tipo de projeto</span><span className="text-foreground font-semibold">{webDevPayload.tipoProjeto.replace(/_/g, " ")}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Horas</span><span className="text-foreground font-semibold">{webDevPayload.horas}h</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor/hora</span><span className="text-foreground font-semibold">R$ {webDevPayload.valorHora.toFixed(2).replace(".", ",")}</span></div>
                    {webDevPayload.descontoAplicado > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Desconto progressivo</span><span className="text-primary font-semibold">-R$ {webDevPayload.descontoAplicado.toLocaleString("pt-BR")}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground font-semibold">R$ {webDevPayload.subtotal.toLocaleString("pt-BR")}</span></div>
                    <div className="h-px bg-muted-foreground/10" />
                    <div className="flex justify-between"><span className="text-muted-foreground">Complexidade</span><span className="text-foreground font-semibold">{webDevPayload.complexidade} {webDevPayload.multiplicadorComplexidade > 1 ? `(×${webDevPayload.multiplicadorComplexidade})` : ""}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Urgência / Prazo</span><span className="text-foreground font-semibold">{webDevPayload.urgencia} / {webDevPayload.prazo.replace(/_/g, " ")} {webDevPayload.multiplicadorPrazoUrgencia > 1 ? `(×${webDevPayload.multiplicadorPrazoUrgencia})` : ""}</span></div>
                    {webDevPayload.continuidade !== "nao" && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Continuidade</span><span className="text-foreground font-semibold">{webDevPayload.continuidade === "mensal" ? "Suporte mensal" : "Sob demanda"}</span></div>
                    )}
                    {webDevPayload.observacoes && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Observações</span><span className="text-foreground font-semibold text-right max-w-[60%]">{webDevPayload.observacoes}</span></div>
                    )}
                    <div className="h-px bg-muted-foreground/10" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-foreground font-bold">Total estimado</span>
                      <span className="text-primary text-xl font-bold">R$ {webDevPayload.totalFinal.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
                <p className="font-body text-xs text-center text-muted-foreground/60">
                  Projeto configurado na página do serviço. Preencha seus dados abaixo para continuar.
                </p>
              </div>
            ) : (
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
            )}
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
          <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Pagamento Confirmado ✓" : "Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado com sucesso" : "Pagamento único via checkout seguro"} status={paymentConfirmed ? "completed" : getStepStatus("payment")}>
             {paymentConfirmed ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                  <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                  <p className="text-sm text-muted-foreground">Avançando para a conclusão...</p>
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
                  {paymentError ? "Tentar novamente" : "COMPRAR AGORA"}
                </Button>
              </div>
            )}
          </WizardStepWrapper>

          {/* Step 5: Conclusão */}
          <WizardStepWrapper stepNumber={5} title="Compra Concluída" subtitle="Fechamento e ativação do serviço" status={paymentConfirmed ? "active" : "pending"} isLast>
            {paymentConfirmed ? (
              <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <h4 className="text-lg font-heading font-bold text-foreground">Pedido concluído com sucesso!</h4>
                <p className="text-sm text-muted-foreground">Redirecionando para a página de confirmação...</p>
                <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
              </div>
            ) : null}
          </WizardStepWrapper>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ContratarServicoPage;
