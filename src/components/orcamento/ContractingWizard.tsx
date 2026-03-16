import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, CreditCard, QrCode, FileBarChart, CheckCircle, Loader2, ExternalLink, AlertTriangle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import WizardStepWrapper from "./WizardStepWrapper";
import QuickRegistrationForm, { type RegistrationData } from "./QuickRegistrationForm";
import { generateContractHtml } from "./ContractPreview";
import type { Plan } from "./PlanSelector";
import type { QualificationData } from "./QualificationForm";
import type { CustomerData } from "./CustomerDataForm";

type BillingType = "BOLETO" | "CREDIT_CARD" | "PIX";

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

const ContractingWizard = ({
  visible,
  effectivePath,
  plan,
  qualification,
  computersQty,
  monthlyValue,
  quoteId,
}: Props) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  type Step = "summary" | "registration" | "contract" | "payment";
  const [currentStep, setCurrentStep] = useState<Step>("summary");
  const stepOrder: Step[] = ["summary", "registration", "contract", "payment"];

  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractSigned, setContractSigned] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState<BillingType | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const [registrationLoading, setRegistrationLoading] = useState(false);

  const wizardRef = useRef<HTMLDivElement>(null);

  // Detect return from contract page
  useEffect(() => {
    const signedId = searchParams.get("contract_signed");
    if (signedId && contractId && signedId === contractId) {
      setContractSigned(true);
      setCurrentStep("payment");
    }
  }, [searchParams, contractId]);

  // Poll for contract signature when on contract step
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

  // ─── Step 1: Summary ───
  const handleContinueFromSummary = () => {
    setCurrentStep("registration");
    scrollToWizardTop();
  };

  // ─── Step 2: Registration ───
  const handleRegistrationComplete = async (data: RegistrationData) => {
    setRegistrationLoading(true);
    try {
      const fullAddress = [data.endereco, data.numero, data.complemento, data.bairro]
        .filter(Boolean)
        .join(", ");

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
        monthlyValue
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

      // Log
      await supabase.from("integration_logs" as any).insert({
        integration_name: "contract",
        operation_name: "contract_created",
        request_payload: { contract_id: (contractRow as any).id, customer_id: customer.id },
        status: "success",
      } as any);

      // Create payment record
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

  // ─── Step 3: Open contract in separate page ───
  const handleOpenContract = () => {
    if (!contractId) return;
    window.open(`/contrato?id=${contractId}`, "_blank");
  };

  // ─── Step 4: Payment ───
  const handlePayment = async () => {
    if (!selectedPayment || !registrationData || !quoteId) return;
    setPaymentLoading(true);
    setPaymentError(null);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];
    const description = `Contrato WMTi — ${pathLabel} — ${computersQty} computador(es)`;

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          customer_name: registrationData.razaoSocial,
          customer_email: registrationData.email,
          customer_cpf_cnpj: registrationData.cnpjOuCpf,
          billing_type: selectedPayment,
          value: monthlyValue,
          due_date: dueDateStr,
          description,
          quote_id: quoteId,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar cobrança");

      const url = data?.invoice_url || null;
      if (!url) throw new Error("O sistema de pagamento não retornou um link de cobrança.");

      setInvoiceUrl(url);
      setPaymentComplete(true);

      setTimeout(() => {
        window.location.href = url;
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[WMTi] Falha no pagamento:", message);
      setPaymentError(message);
      setPaymentComplete(false);
      setInvoiceUrl(null);
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <section id="contracting-wizard" className="py-16 section-dark" ref={wizardRef}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
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
          {/* ─── Step 1: Summary ─── */}
          <WizardStepWrapper
            stepNumber={1}
            title="Resumo do Orçamento"
            subtitle="Revise o valor e plano escolhido"
            status={getStepStatus("summary")}
          >
            <div className="bg-card border border-border rounded-xl p-5 space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Modalidade</span>
                <span className="font-semibold text-foreground">{pathLabel}</span>
              </div>
              {effectivePath === "locacao" && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Plano</span>
                  <span className="font-semibold text-foreground">{plan.name}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Computadores</span>
                <span className="font-semibold text-foreground">{computersQty}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-3">
                <span className="text-sm font-semibold text-foreground">Valor mensal</span>
                <span className="text-xl font-bold text-primary">
                  R$ {monthlyValue.toLocaleString("pt-BR")},00
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Prazo mínimo contratual de 36 meses.
              </p>
            </div>
            <Button
              onClick={handleContinueFromSummary}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Continuar contratação
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </WizardStepWrapper>

          {/* ─── Step 2: Registration ─── */}
          <WizardStepWrapper
            stepNumber={2}
            title="Dados do Contratante"
            subtitle="Preenchimento automático por CNPJ e CEP"
            status={getStepStatus("registration")}
          >
            <QuickRegistrationForm
              onComplete={handleRegistrationComplete}
              loading={registrationLoading}
            />
          </WizardStepWrapper>

          {/* ─── Step 3: Contract (opens in separate page) ─── */}
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
                  <p className="text-xs text-muted-foreground mb-3">
                    Após ler e assinar o contrato, esta página será atualizada automaticamente.
                  </p>
                </div>

                <Button
                  onClick={handleOpenContract}
                  disabled={!contractId}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
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

          {/* ─── Step 4: Payment ─── */}
          <WizardStepWrapper
            stepNumber={4}
            title="Pagamento"
            subtitle="Escolha a forma e finalize"
            status={getStepStatus("payment")}
            isLast
          >
            {paymentComplete && invoiceUrl ? (
              <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                <h4 className="text-lg font-heading font-bold">Cobrança gerada!</h4>
                <p className="text-sm text-muted-foreground">Redirecionando para o checkout...</p>
                <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                <Button asChild variant="outline" className="w-full h-10 mt-2">
                  <a href={invoiceUrl}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Caso não seja redirecionado, clique aqui
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Valor mensal: <strong className="text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</strong>
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

                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: "PIX" as BillingType, icon: QrCode, label: "PIX", desc: "Instantâneo" },
                    { id: "BOLETO" as BillingType, icon: FileBarChart, label: "Boleto", desc: "3 dias úteis" },
                    { id: "CREDIT_CARD" as BillingType, icon: CreditCard, label: "Cartão", desc: "Recorrente" },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedPayment(m.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selectedPayment === m.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <m.icon className={`w-6 h-6 mx-auto mb-2 ${selectedPayment === m.id ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handlePayment}
                  disabled={!selectedPayment || paymentLoading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
                >
                  {paymentLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  {paymentError ? "Tentar novamente" : "Gerar cobrança e pagar"}
                </Button>
              </div>
            )}
          </WizardStepWrapper>
        </div>
      </div>
    </section>
  );
};

export default ContractingWizard;
