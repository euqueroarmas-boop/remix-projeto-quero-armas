import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  CreditCard,
  FileBarChart,
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import WizardStepWrapper from "./WizardStepWrapper";
import QuickRegistrationForm, { type RegistrationData } from "./QuickRegistrationForm";
import PlanConfigStep from "./PlanConfigStep";
import { generateContractHtml } from "./ContractPreview";
import { generateContractFromTemplate } from "@/lib/contractTemplate";
import { getServiceContractObject } from "@/lib/serviceContractMap";
import { captureClientProof } from "@/lib/clientProof";
import { valueToWords } from "./ContractPreview";
import { calculatePricing, type PlanConfig, type PricingBreakdown, type ContractTerm } from "@/lib/contractPricing";
import PostPaymentReport from "./PostPaymentReport";
import OutsourcingOffer from "./OutsourcingOffer";

import type { Plan } from "./PlanSelector";
import type { QualificationData } from "./QualificationForm";
import type { CustomerData } from "./CustomerDataForm";

type BillingType = "BOLETO" | "CREDIT_CARD";

interface NormalizedPaymentData {
  success: boolean;
  billingType: BillingType;
  invoiceUrl: string | null;
  pixQrCodeImage: string | null;
  pixCopyPaste: string | null;
  asaasPaymentId: string | null;
  status: string;
}

interface Props {
  visible: boolean;
  effectivePath: "locacao" | "suporte" | null;
  plan: Plan;
  qualification: QualificationData | null;
  computersQty: number;
  monthlyValue: number;
  quoteId: string | null;
  serviceSlug?: string;
  leadCompanyName?: string;
  leadContactName?: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCity?: string;
  leadCnpj?: string;
  leadNomeFantasia?: string;
  leadUf?: string;
  leadCep?: string;
  leadEndereco?: string;
  leadNumero?: string;
  leadComplemento?: string;
  leadBairro?: string;
  customRegistrationForm?: (onComplete: (data: RegistrationData) => Promise<void>, loading: boolean) => React.ReactNode;
}

const normalizeQrImage = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
};

const normalizePaymentPayload = (raw: any, fallbackBillingType: BillingType): NormalizedPaymentData => {
  const billingType = (raw?.billingType || raw?.billing_type || fallbackBillingType) as BillingType;
  return {
    success: raw?.success !== false,
    billingType,
    invoiceUrl: raw?.invoiceUrl || raw?.invoice_url || raw?.bankSlipUrl || raw?.payment?.invoiceUrl || null,
    pixQrCodeImage: normalizeQrImage(raw?.pixQrCodeImage || raw?.pix_qr_code_image || raw?.pix?.qrCodeImage || raw?.pix?.encodedImage),
    pixCopyPaste: raw?.pixCopyPaste || raw?.pix_copy_paste || raw?.pix?.copyPaste || raw?.pix?.payload || raw?.payload || null,
    asaasPaymentId: raw?.asaasPaymentId || raw?.payment_id || raw?.id || null,
    status: String(raw?.status || "pending").toLowerCase(),
  };
};

const isPaidStatus = (status?: string | null) => {
  const normalized = String(status || "").toUpperCase();
  return normalized === "CONFIRMED" || normalized === "RECEIVED" || normalized === "PAYMENT_CONFIRMED" || normalized === "PAYMENT_RECEIVED";
};

/* ─── Session recovery helpers ─── */
const SESSION_KEY = "orcamentoWMti_session";

const saveSession = (data: Record<string, any>) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
};

const loadSession = (): Record<string, any> | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearSession = () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

const ContractingWizard = ({
  visible,
  effectivePath,
  plan,
  qualification,
  computersQty,
  monthlyValue,
  quoteId,
  serviceSlug,
  leadCompanyName,
  leadContactName,
  leadEmail,
  leadPhone,
  leadCity,
  leadCnpj,
  leadNomeFantasia,
  leadUf,
  leadCep,
  leadEndereco,
  leadNumero,
  leadComplemento,
  leadBairro,
  customRegistrationForm,
}: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  type Step = "registration" | "planConfig" | "contract" | "payment";
  const [currentStep, setCurrentStep] = useState<Step>("registration");
  const stepOrder: Step[] = ["registration", "planConfig", "contract", "payment"];

  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(quoteId);
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractSigned, setContractSigned] = useState(false);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);

  const [selectedPayment, setSelectedPayment] = useState<BillingType | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentData, setPaymentData] = useState<NormalizedPaymentData | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  

  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const wizardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveQuoteId(quoteId);
  }, [quoteId]);

  // Save session when payment completes (for recovery)
  useEffect(() => {
    if (paymentComplete && paymentData) {
      saveSession({
        registrationData,
        contractId,
        selectedPayment: paymentData.billingType,
        invoiceUrl: paymentData.invoiceUrl,
        quoteId: activeQuoteId,
      });
    }
  }, [paymentComplete, paymentData, registrationData, contractId, activeQuoteId]);

  useEffect(() => {
    const signedId = searchParams.get("contract_signed");
    if (signedId && contractId && signedId === contractId) {
      setContractSigned(true);
      setCurrentStep("payment");
    }
  }, [searchParams, contractId]);

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
        scrollToWizardTop();
        toast({ title: "Contrato assinado!", description: "Prossiga com o pagamento." });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentStep, contractId, contractSigned, toast]);

  // Poll for payment confirmation + send email
  useEffect(() => {
    if (!paymentComplete || paymentConfirmed || !activeQuoteId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("payment_status")
        .eq("quote_id", activeQuoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data && isPaidStatus((data as any).payment_status)) {
        setPaymentConfirmed(true);
        // Email is now sent from webhook after user creation (includes credentials)
        const purchaseData = {
          serviceName: effectivePath === "locacao" ? "Locação de Equipamentos" : "Serviços de TI",
          computersQty,
          monthlyValue: pricingBreakdown?.valorFinalMensal ?? monthlyValue,
          isRecurring: true,
          customerName: registrationData?.razaoSocial || "",
          customerCpfCnpj: registrationData?.cnpjOuCpf || "",
          customerEmail: registrationData?.email || "",
          paymentMethod: selectedPayment || "CREDIT_CARD",
          contractId,
          purchaseDate: new Date().toLocaleDateString("pt-BR"),
        };
        try { sessionStorage.setItem("wmti_purchase_data", JSON.stringify(purchaseData)); } catch {}
        navigate(`/compra-concluida?quote=${activeQuoteId}`);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [paymentComplete, paymentConfirmed, activeQuoteId, registrationData, selectedPayment, contractId, effectivePath, computersQty, monthlyValue, pricingBreakdown]);

  // Open checkout in new tab — detects popup blocker
  const handleRedirectToCheckout = useCallback((url: string) => {
    if (!url) return;
    setPopupBlocked(false);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      setPopupBlocked(true);
      console.warn("[WMTi] Popup bloqueado pelo navegador");
    }
  }, []);


  // All hooks above — safe to return null now
  if (!visible || !effectivePath) return null;

  const getStepStatus = (step: Step) => {
    const currentIdx = stepOrder.indexOf(currentStep);
    const stepIdx = stepOrder.indexOf(step);
    if (stepIdx < currentIdx) return "completed" as const;
    if (stepIdx === currentIdx) return "active" as const;
    return "pending" as const;
  };

  const scrollToWizardTop = () => {
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const contractType = effectivePath === "locacao" ? "locacao" : "suporte";
  const pathLabel = effectivePath === "locacao" ? "Locação de Equipamentos" : "Serviços de TI";

  const handleRegistrationComplete = async (data: RegistrationData) => {
    setRegistrationLoading(true);
    try {
      const fullAddress = [data.endereco, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");

      const { data: row, error } = await supabase
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

      if (error) throw error;
      const customer = row as any;
      setCustomerId(customer.id);
      setRegistrationData(data);

      let resolvedQuoteId = activeQuoteId;

      if (!resolvedQuoteId) {
        const { data: createdQuote, error: quoteError } = await supabase
          .from("quotes" as any)
          .insert({
            selected_plan: effectivePath === "locacao" ? plan.id : "suporte-mensal",
            computers_qty: computersQty,
            users_qty: qualification?.dailyUsers ?? computersQty,
            needs_server_migration: false,
            needs_remote_access: qualification?.needsRemoteAccess || false,
            needs_backup: qualification?.needsBackup || false,
            monthly_value: monthlyValue,
            status: "pending",
          } as any)
          .select()
          .single();

        if (quoteError) throw quoteError;
        resolvedQuoteId = (createdQuote as any).id;
        setActiveQuoteId(resolvedQuoteId);
      }

      setCurrentStep("planConfig");
      scrollToWizardTop();
    } catch (err) {
      console.error("[WMTi] Erro no cadastro:", err);
      toast({ title: "Erro ao salvar dados", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handlePlanConfigConfirm = async (config: PlanConfig, pricing: PricingBreakdown) => {
    setPlanConfig(config);
    setPricingBreakdown(pricing);

    if (!registrationData || !customerId || !activeQuoteId) return;

    setRegistrationLoading(true);
    try {
      const fullAddress = [registrationData.endereco, registrationData.numero, registrationData.complemento, registrationData.bairro].filter(Boolean).join(", ");

      const customerDataForContract: CustomerData = {
        ...registrationData,
        endereco: fullAddress,
        cidade: `${registrationData.cidade}/${registrationData.uf}`,
      };

      const finalMonthlyValue = pricing.valorFinalMensal;

      let html: string;

      // Capture client proof data for legal validity (clause 17.3)
      const proof = await captureClientProof();

      // Due date = same day of month, next month
      const today = new Date();
      const diaVencimento = String(today.getDate());

      // Resolve service-specific contract object
      const objetoServico = serviceSlug
        ? getServiceContractObject(serviceSlug)
        : "Os serviços de T.I. objeto deste contrato serão aqueles especificamente definidos no momento da contratação, conforme escopo acordado entre as partes.";

      if (contractType === "suporte") {
        const templateHtml = await generateContractFromTemplate("wmti_servicos_base_v1", {
          cliente_razao_social: registrationData.razaoSocial,
          cliente_cnpj: registrationData.cnpjOuCpf,
          cliente_endereco_completo: fullAddress + ", " + registrationData.cidade + "/" + registrationData.uf + ", CEP " + registrationData.cep,
          representante_nome_completo: registrationData.responsavel,
          representante_cpf: registrationData.responsavelCpf || (registrationData.cnpjOuCpf.replace(/\D/g, "").length <= 11 ? registrationData.cnpjOuCpf : ""),
          representante_email: registrationData.email,
          representante_telefone: registrationData.whatsapp || registrationData.telefone || "",
          prazo_meses: String(config.termMonths),
          data_contratacao: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
          ip_contratante: proof.ip_contratante,
          geo_contratante: proof.geo_contratante,
          aceite_checkbox: "Sim",
          objeto_servico_especifico: objetoServico,
          valor_mensal: finalMonthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          valor_mensal_extenso: valueToWords(finalMonthlyValue),
          dia_vencimento: diaVencimento,
          data_hora_contratacao: proof.data_hora_contratacao,
          user_agent: proof.user_agent,
          session_id: proof.session_id,
        });
        html = templateHtml || generateContractHtml(
          customerDataForContract,
          "suporte",
          null,
          computersQty,
          finalMonthlyValue,
        );
      } else {
        html = generateContractHtml(
          customerDataForContract,
          "locacao",
          plan,
          computersQty,
          finalMonthlyValue,
        );
      }

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(html));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: contractRow, error: contractErr } = await supabase
        .from("contracts" as any)
        .insert({
          quote_id: activeQuoteId,
          customer_id: customerId,
          contract_type: contractType,
          contract_text: html,
          monthly_value: finalMonthlyValue,
          contract_hash: contractHash,
          client_ip: proof.ip_contratante,
          status: "draft",
          signed: false,
          accepted_minimum_term: false,
        } as any)
        .select()
        .single();

      if (contractErr) throw contractErr;
      setContractId((contractRow as any).id);

      if (effectivePath === "locacao") {
        await supabase.from("contract_equipment" as any).insert({
          contract_id: (contractRow as any).id,
          computer_model: "Dell OptiPlex",
          cpu: plan.cpu,
          cpu_generation: plan.cpu,
          ram: plan.ram.replace(" RAM", ""),
          ssd: plan.ssd.replace(" SSD", ""),
          network: "Placa de rede Gigabit",
          monitor_brand: "Dell",
          monitor_size: '18.5"',
          keyboard_model: "Teclado USB ABNT2",
          mouse_model: "Mouse óptico USB",
          quantity: computersQty,
          unit_price: plan.price,
          monthly_total: finalMonthlyValue,
        } as any);
      }

      await supabase.from("integration_logs" as any).insert({
        integration_name: "contract",
        operation_name: "contract_created",
        request_payload: {
          contract_id: (contractRow as any).id,
          customer_id: customerId,
          quote_id: activeQuoteId,
          contract_type: contractType,
          template_id: contractType === "suporte" ? "wmti_recorrente_v1" : null,
          template_version: contractType === "suporte" ? "1.0" : null,
          term_months: config.termMonths,
          support_24h: config.support24h,
          valor_base: pricing.valorBase,
          desconto_percentual: pricing.descontoPercentual,
          valor_com_desconto: pricing.valorComDesconto,
          valor_adicional_24h: pricing.valorAdicional24h,
          valor_final_mensal: pricing.valorFinalMensal,
          aceite: true,
          timestamp: new Date().toISOString(),
        },
        status: "success",
      } as any);

      // Update quote with final value
      await supabase.from("quotes" as any)
        .update({ monthly_value: finalMonthlyValue } as any)
        .eq("id", activeQuoteId);

      await supabase.from("payments" as any).insert({
        quote_id: activeQuoteId,
        payment_status: "pending",
      } as any);

      setCurrentStep("contract");
      scrollToWizardTop();
    } catch (err) {
      console.error("[WMTi] Erro ao gerar contrato:", err);
      toast({ title: "Erro ao gerar contrato", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleOpenContract = () => {
    if (!contractId) return;
    window.open(`/contrato?id=${contractId}`, "_blank");
  };

  const handleRetryPayment = () => {
    setPaymentComplete(false);
    setPaymentData(null);
    setInvoiceUrl(null);
    setPaymentError(null);
  };

  const paymentLockRef = useRef(false);

  const handlePayment = async () => {
    if (!selectedPayment || !registrationData || !activeQuoteId) return;
    if (paymentLockRef.current) {
      console.warn("[WMTi][payment] Chamada duplicada bloqueada (ContractingWizard)");
      return;
    }
    paymentLockRef.current = true;
    setPaymentLoading(true);
    setPaymentError(null);
    setPaymentComplete(false);
    setPaymentData(null);
    setInvoiceUrl(null);

    const finalValue = pricingBreakdown?.valorFinalMensal ?? monthlyValue;
    const termLabel = planConfig ? `${planConfig.termMonths} meses` : "36 meses";
    const description = `Contrato WMTi — ${pathLabel} — ${computersQty} computador(es) — ${termLabel}${planConfig?.support24h ? " — 24h" : ""}`;

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-subscription", {
        body: {
          customer_name: registrationData.razaoSocial,
          customer_email: registrationData.email,
          customer_cpf_cnpj: registrationData.cnpjOuCpf,
          billing_type: selectedPayment,
          value: finalValue,
          description,
          quote_id: activeQuoteId,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar assinatura");

      // If already paid, redirect immediately
      if (data?.already_paid) {
        navigate(`/compra-concluida?quote=${activeQuoteId}`);
        return;
      }

      const normalized = normalizePaymentPayload(data, selectedPayment);

      if (!normalized.success) {
        throw new Error("A assinatura não foi confirmada pelo backend.");
      }

      if (!normalized.invoiceUrl) {
        throw new Error("O sistema de pagamento não retornou um link de cobrança. Tente novamente.");
      }

      setPaymentData(normalized);
      setInvoiceUrl(normalized.invoiceUrl);
      setPaymentComplete(true);

      handleRedirectToCheckout(normalized.invoiceUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[WMTi][payment] Ponto de falha no fluxo:", message);
      setPaymentError(message);
      setPaymentComplete(false);
      setInvoiceUrl(null);
      setPaymentData(null);
    } finally {
      setPaymentLoading(false);
      paymentLockRef.current = false;
    }
  };

  const initialRegistrationData: Partial<RegistrationData> = {
    razaoSocial: leadCompanyName || "",
    nomeFantasia: leadNomeFantasia || "",
    cnpjOuCpf: leadCnpj || qualification?.cnpj || "",
    responsavel: leadContactName || "",
    email: leadEmail || "",
    telefone: leadPhone || "",
    cep: leadCep || qualification?.cep || "",
    endereco: leadEndereco || qualification?.address || "",
    numero: leadNumero || "",
    complemento: leadComplemento || "",
    bairro: leadBairro || "",
    cidade: leadCity || qualification?.city || "",
    uf: leadUf || qualification?.state || "",
    isPJ: !!(leadCnpj && leadCnpj.replace(/\D/g, "").length > 11),
  };

  const showOutsourcingAfterPayment = paymentComplete && qualification?.hasInternalTech === "Sim";

  return (
    <>
      <section id="contracting-wizard" className="py-16 section-dark" ref={wizardRef}>
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Contratação
            </span>
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2">
              Finalize sua <span className="text-primary">contratação</span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Preencha os dados uma única vez. Tudo será reaproveitado automaticamente.
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            {/* Step 1: Registration */}
            <WizardStepWrapper
              stepNumber={1}
              title="Dados do Contratante"
              subtitle="Preenchimento automático por CNPJ e CEP"
              status={getStepStatus("registration")}
            >
              {customRegistrationForm
                ? customRegistrationForm(handleRegistrationComplete, registrationLoading)
                : <QuickRegistrationForm onComplete={handleRegistrationComplete} loading={registrationLoading} initialData={initialRegistrationData} />
              }
            </WizardStepWrapper>

            {/* Step 2: Plan Configuration */}
            <WizardStepWrapper
              stepNumber={2}
              title="Configuração do Plano"
              subtitle={pricingBreakdown ? `${planConfig?.termMonths} meses${planConfig?.support24h ? " • 24h" : ""} ✓` : "Escolha o prazo e nível de atendimento"}
              status={getStepStatus("planConfig")}
            >
              {pricingBreakdown && currentStep !== "planConfig" ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                  <Settings2 className="w-10 h-10 text-primary mx-auto" />
                  <h4 className="text-lg font-heading font-bold">Plano configurado!</h4>
                  <p className="text-sm text-muted-foreground">
                    {planConfig?.termMonths} meses{planConfig?.support24h ? " • Suporte 24h" : ""} — R$ {pricingBreakdown.valorFinalMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
                  </p>
                </div>
              ) : (
                <PlanConfigStep
                  valorBase={monthlyValue}
                  onConfirm={handlePlanConfigConfirm}
                  initialConfig={planConfig}
                />
              )}
            </WizardStepWrapper>

            {/* Step 3: Contract */}
            <WizardStepWrapper
              stepNumber={3}
              title="Contrato e Assinatura"
              subtitle={contractSigned ? "Contrato assinado ✓" : "Leia e assine o contrato em página dedicada"}
              status={getStepStatus("contract")}
            >
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
                        <p className="font-semibold text-sm">Contrato de {pathLabel}</p>
                        <p className="text-xs text-muted-foreground">O contrato será aberto em uma página separada com aparência de documento formal.</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Após ler e assinar o contrato, esta página será atualizada automaticamente.</p>
                  </div>

                  <Button onClick={handleOpenContract} disabled={!contractId} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="botao-abrir-contrato">
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
            <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? "Compra Concluída" : "Pagamento"} subtitle={paymentConfirmed ? "Pagamento confirmado ✓" : "Ao prosseguir, você será direcionado para a página segura de checkout"} status={paymentConfirmed ? "completed" : getStepStatus("payment")} isLast>
              {paymentConfirmed ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                  <h4 className="text-lg font-heading font-bold">Pagamento confirmado!</h4>
                  <p className="text-sm text-muted-foreground">Redirecionando para a página de confirmação...</p>
                  <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                </div>
              ) : paymentLoading ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <h4 className="text-lg font-heading font-bold">Aguarde, estamos conectando você ao checkout...</h4>
                    <p className="text-sm text-muted-foreground">Não feche esta página.</p>
                  </div>
                </div>
              ) : paymentComplete && paymentData?.invoiceUrl ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <h4 className="text-lg font-heading font-bold">Aguardando confirmação do pagamento...</h4>
                    {popupBlocked ? (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-left">
                        <p className="text-sm text-amber-300 font-semibold mb-1">⚠️ O navegador bloqueou a abertura automática</p>
                        <p className="text-xs text-muted-foreground">Clique no botão abaixo para abrir o checkout manualmente.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        A página segura de pagamento foi aberta em outra aba. Conclua por lá sua contratação.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => handleRedirectToCheckout(paymentData.invoiceUrl!)} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {popupBlocked ? "Abrir checkout" : "Abrir checkout novamente"}
                    </Button>
                    <Button onClick={handleRetryPayment} variant="ghost" className="w-full h-10 text-muted-foreground">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Escolher outra forma de pagamento
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Ao prosseguir, você será direcionado para a página segura de checkout para preencher seus dados e concluir a contratação.
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    Valor mensal: <strong className="text-primary">R$ {(pricingBreakdown?.valorFinalMensal ?? monthlyValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Assinatura recorrente mensal — prazo de {planConfig?.termMonths ?? 36} meses com renovação automática
                    {planConfig?.support24h ? " • Suporte 24h" : ""}
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
                    {[
                      { id: "BOLETO" as BillingType, icon: FileBarChart, label: "Boleto Bancário", desc: "Recorrente mensal" },
                      { id: "CREDIT_CARD" as BillingType, icon: CreditCard, label: "Cartão de Crédito", desc: "Recorrente mensal" },
                    ].map((method) => (
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

                  <p className="text-xs text-muted-foreground text-center italic">
                    Você será direcionado para a página segura de pagamento.
                  </p>

                  <Button onClick={handlePayment} disabled={!selectedPayment || paymentLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50" data-testid="botao-ir-checkout">
                    <ExternalLink className="w-5 h-5 mr-2" />
                    {paymentError ? "Tentar novamente" : "PROSSEGUIR PARA PAGAMENTO"}
                  </Button>
                </div>
              )}
            </WizardStepWrapper>
          </div>
        </div>
      </section>

      {/* Post-payment report */}
      <PostPaymentReport
        visible={paymentComplete}
        effectivePath={effectivePath}
        plan={plan}
        qualification={qualification}
        registration={registrationData}
        computersQty={computersQty}
        monthlyValue={pricingBreakdown?.valorFinalMensal ?? monthlyValue}
      />

      {/* Outsourcing offer — only after payment AND only if has internal tech */}
      <OutsourcingOffer visible={showOutsourcingAfterPayment} />
    </>
  );
};

const HelperLabel = ({ className = "", ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`block ${className}`.trim()} {...props} />
);

export default ContractingWizard;
