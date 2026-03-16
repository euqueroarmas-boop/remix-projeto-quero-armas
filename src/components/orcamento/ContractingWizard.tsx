import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, PenTool, CreditCard, QrCode, FileBarChart, CheckCircle, Loader2, ExternalLink, AlertTriangle, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  // Budget lead data for reuse
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

  // Step management
  type Step = "summary" | "registration" | "contract" | "signature" | "payment";
  const [currentStep, setCurrentStep] = useState<Step>("summary");
  const stepOrder: Step[] = ["summary", "registration", "contract", "signature", "payment"];

  // Registration data
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Contract
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractHtml, setContractHtml] = useState<string>("");
  const [contractAgreed, setContractAgreed] = useState(false);

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");

  // Payment
  const [selectedPayment, setSelectedPayment] = useState<BillingType | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Loading states
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);

  const wizardRef = useRef<HTMLDivElement>(null);

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

  // ─── Step 1: Summary → Continue ───
  const handleContinueFromSummary = () => {
    setCurrentStep("registration");
    scrollToWizardTop();
  };

  // ─── Step 2: Registration complete ───
  const handleRegistrationComplete = async (data: RegistrationData) => {
    setRegistrationLoading(true);
    try {
      console.log("[WMTi] Salvando dados do contratante...");

      const fullAddress = [data.endereco, data.numero, data.complemento, data.bairro]
        .filter(Boolean)
        .join(", ");

      // Save customer
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

      // Convert to CustomerData for contract generation
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

      // Generate contract
      console.log("[WMTi] Gerando contrato automaticamente...");
      const html = generateContractHtml(
        customerDataForContract,
        contractType as "locacao" | "suporte",
        effectivePath === "locacao" ? plan : null,
        computersQty,
        monthlyValue
      );
      setContractHtml(html);

      // Hash
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(html));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Save contract
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
        } as any)
        .select()
        .single();

      if (contractErr) throw contractErr;
      setContractId((contractRow as any).id);
      console.log("[WMTi] Contrato gerado. ID:", (contractRow as any).id);

      // Save equipment for rental
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

      setSignerName(data.responsavel);
      setCurrentStep("contract");
      scrollToWizardTop();
    } catch (err) {
      console.error("[WMTi] Erro no cadastro:", err);
      toast({ title: "Erro ao salvar dados", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setRegistrationLoading(false);
    }
  };

  // ─── Step 3: Contract agreed ───
  const handleContractContinue = () => {
    if (!contractAgreed) return;
    setCurrentStep("signature");
    scrollToWizardTop();

    // Init canvas after render
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1a1a2e";
    }, 200);
  };

  // ─── Step 4: Signature ───
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!canvasRef.current || !hasDrawn || !signerName.trim() || !contractId) return;
    setSigningLoading(true);
    try {
      const signatureData = canvasRef.current.toDataURL("image/png");

      let clientIp = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        clientIp = data.ip;
      } catch {}

      const userAgent = navigator.userAgent;

      const { data: contractRow } = await supabase
        .from("contracts" as any)
        .select("contract_hash")
        .eq("id", contractId)
        .single();
      const contractHash = (contractRow as any)?.contract_hash || "";

      await supabase.from("contract_signatures" as any).insert({
        contract_id: contractId,
        signer_name: signerName.trim(),
        signature_data: signatureData,
        ip_address: clientIp,
        user_agent: userAgent,
        contract_hash: contractHash,
      } as any);

      await supabase
        .from("contracts" as any)
        .update({
          signed: true,
          signed_at: new Date().toISOString(),
          client_ip: clientIp,
          status: "AGUARDANDO PAGAMENTO",
        } as any)
        .eq("id", contractId);

      await supabase.from("payments" as any).insert({
        quote_id: quoteId,
        payment_status: "pending",
      } as any);

      console.log("[WMTi] Contrato assinado com sucesso.");
      setCurrentStep("payment");
      scrollToWizardTop();
    } catch (err) {
      console.error("[WMTi] Erro na assinatura:", err);
      toast({ title: "Erro ao assinar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSigningLoading(false);
    }
  };

  // ─── Step 5: Payment ───
  const handlePayment = async () => {
    if (!selectedPayment || !registrationData || !quoteId) return;
    setPaymentLoading(true);
    setPaymentError(null);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];
    const description = `Contrato WMTi — ${pathLabel} — ${computersQty} computador(es)`;

    try {
      console.log("[WMTi] Criando cobrança...", { billingType: selectedPayment, monthlyValue });

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

      console.log("[WMTi] Cobrança criada. URL:", url);
      setInvoiceUrl(url);
      setPaymentComplete(true);

      // Auto-redirect
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

          {/* ─── Step 3: Contract ─── */}
          <WizardStepWrapper
            stepNumber={3}
            title="Contrato"
            subtitle="Gerado automaticamente — sem dados repetidos"
            status={getStepStatus("contract")}
          >
            <div className="space-y-4">
              <div className="bg-background border border-border rounded-xl p-5 max-h-[400px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">{pathLabel}</span>
                </div>
                <div
                  className="prose prose-sm max-w-none text-foreground/80"
                  dangerouslySetInnerHTML={{ __html: contractHtml }}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border bg-card">
                <Checkbox
                  checked={contractAgreed}
                  onCheckedChange={(v) => setContractAgreed(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground/80">
                  Declaro estar ciente de que a contratação da WMTi possui{" "}
                  <strong>prazo mínimo de 36 meses</strong> e exige assinatura contratual.
                </span>
              </label>

              <Button
                onClick={handleContractContinue}
                disabled={!contractAgreed}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
              >
                Concordo e quero assinar
                <PenTool className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </WizardStepWrapper>

          {/* ─── Step 4: Signature ─── */}
          <WizardStepWrapper
            stepNumber={4}
            title="Assinatura Digital"
            subtitle="Desenhe sua assinatura"
            status={getStepStatus("signature")}
          >
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-sm">Nome do assinante *</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="h-12 bg-card border-border"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-sm">Desenhe sua assinatura</Label>
                <div className="relative border-2 border-dashed border-border rounded-xl bg-background overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: 160 }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-muted-foreground/40 text-sm flex items-center gap-2">
                        <PenTool className="w-4 h-4" /> Desenhe aqui
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-muted-foreground text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleSign}
                disabled={!hasDrawn || !signerName.trim() || signingLoading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
              >
                {signingLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <PenTool className="w-4 h-4 mr-2" />
                )}
                Assinar contrato
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Sua assinatura, IP e data serão registrados para segurança jurídica.
              </p>
            </div>
          </WizardStepWrapper>

          {/* ─── Step 5: Payment ─── */}
          <WizardStepWrapper
            stepNumber={5}
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
