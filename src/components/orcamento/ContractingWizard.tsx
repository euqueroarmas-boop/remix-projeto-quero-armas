import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import WizardStepWrapper from "./WizardStepWrapper";
import QuickRegistrationForm, { type RegistrationData } from "./QuickRegistrationForm";
import { generateContractHtml } from "./ContractPreview";
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
  leadCompanyName?: string;
  leadContactName?: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCity?: string;
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
  leadCompanyName,
  leadContactName,
  leadEmail,
  leadPhone,
  leadCity,
}: Props) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  type Step = "registration" | "contract" | "payment";
  const [currentStep, setCurrentStep] = useState<Step>("registration");
  const stepOrder: Step[] = ["registration", "contract", "payment"];

  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractSigned, setContractSigned] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState<BillingType | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentData, setPaymentData] = useState<NormalizedPaymentData | null>(null);

  const [registrationLoading, setRegistrationLoading] = useState(false);

  const wizardRef = useRef<HTMLDivElement>(null);

  // Save session when payment completes (for recovery)
  useEffect(() => {
    if (paymentComplete && paymentData) {
      saveSession({
        registrationData,
        contractId,
        selectedPayment: paymentData.billingType,
        invoiceUrl: paymentData.invoiceUrl,
        quoteId,
      });
    }
  }, [paymentComplete, paymentData, registrationData, contractId, quoteId]);

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

  // Redirect only after confirmed invoiceUrl
  const handleRedirectToCheckout = useCallback((url: string) => {
    if (!url) return;
    window.location.href = url;
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

      const html = generateContractHtml(
        customerDataForContract,
        contractType as "locacao" | "suporte",
        effectivePath === "locacao" ? plan : null,
        computersQty,
        monthlyValue,
      );

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(html));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: contractRow, error: contractErr } = await supabase
        .from("contracts" as any)
        .insert({
          quote_id: quoteId,
          customer_id: customer.id,
          contract_type: contractType,
          contract_text: html,
          monthly_value: monthlyValue,
          contract_hash: contractHash,
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
          monthly_total: monthlyValue,
        } as any);
      }

      await supabase.from("integration_logs" as any).insert({
        integration_name: "contract",
        operation_name: "contract_created",
        request_payload: { contract_id: (contractRow as any).id, customer_id: customer.id, customerId },
        status: "success",
      } as any);

      await supabase.from("payments" as any).insert({
        quote_id: quoteId,
        payment_status: "pending",
      } as any);

      setCurrentStep("contract");
      scrollToWizardTop();
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

  const handleRetryPayment = () => {
    setPaymentComplete(false);
    setPaymentData(null);
    setInvoiceUrl(null);
    setPaymentError(null);
  };

  const handlePayment = async () => {
    if (!selectedPayment || !registrationData || !quoteId) return;
    setPaymentLoading(true);
    setPaymentError(null);
    setPaymentComplete(false);
    setPaymentData(null);
    setInvoiceUrl(null);

    const description = `Contrato WMTi — ${pathLabel} — ${computersQty} computador(es)`;

    try {
      // Use subscription endpoint for contract-based recurring payments
      const { data, error } = await supabase.functions.invoke("create-asaas-subscription", {
        body: {
          customer_name: registrationData.razaoSocial,
          customer_email: registrationData.email,
          customer_cpf_cnpj: registrationData.cnpjOuCpf,
          billing_type: selectedPayment,
          value: monthlyValue,
          description,
          quote_id: quoteId,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar assinatura");

      const normalized = normalizePaymentPayload(data, selectedPayment);

      setPaymentData(normalized);
      setInvoiceUrl(normalized.invoiceUrl);
      setPaymentComplete(normalized.success);

      if (!normalized.success) {
        throw new Error("A assinatura não foi confirmada pelo backend.");
      }

      if (!normalized.invoiceUrl) {
        throw new Error("O sistema de pagamento não retornou um link de cobrança.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[WMTi][payment] Ponto de falha no fluxo:", message);
      setPaymentError(message);
      setPaymentComplete(false);
      setInvoiceUrl(null);
      setPaymentData(null);
    } finally {
      setPaymentLoading(false);
    }
  };

  const initialRegistrationData: Partial<RegistrationData> = {
    razaoSocial: leadCompanyName || "",
    nomeFantasia: "",
    cnpjOuCpf: qualification?.cnpj || "",
    responsavel: leadContactName || "",
    email: leadEmail || "",
    telefone: leadPhone || "",
    cep: qualification?.cep || "",
    endereco: qualification?.address || "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: qualification?.city || leadCity || "",
    uf: qualification?.state || "",
    isPJ: true,
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
              <QuickRegistrationForm onComplete={handleRegistrationComplete} loading={registrationLoading} initialData={initialRegistrationData} />
            </WizardStepWrapper>

            {/* Step 2: Contract */}
            <WizardStepWrapper
              stepNumber={2}
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

            {/* Step 3: Payment */}
            <WizardStepWrapper stepNumber={3} title="Pagamento" subtitle="Escolha a forma e finalize" status={getStepStatus("payment")} isLast>
              {paymentComplete && paymentData?.invoiceUrl ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-primary" />
                    <h4 className="text-lg font-heading font-bold">Cobrança gerada!</h4>
                    <p className="text-sm text-muted-foreground">Redirecionando para o checkout...</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outline" className="w-full h-10">
                      <a href={paymentData.invoiceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Caso não seja redirecionado, clique aqui
                      </a>
                    </Button>
                    <Button onClick={handleRetryPayment} variant="ghost" className="w-full h-10 text-muted-foreground">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Voltar para o pagamento
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Valor mensal: <strong className="text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</strong>
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Assinatura recorrente mensal — prazo de 36 meses com renovação automática
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
                      { id: "BOLETO" as BillingType, icon: FileBarChart, label: "Boleto", desc: "Recorrente mensal" },
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
                        <p className="text-sm font-semibold">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.desc}</p>
                      </button>
                    ))}
                  </div>

                  <Button onClick={handlePayment} disabled={!selectedPayment || paymentLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
                    {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                    {paymentError ? "Tentar novamente" : "Criar assinatura e pagar"}
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
        monthlyValue={monthlyValue}
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
